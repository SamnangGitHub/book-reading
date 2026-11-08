import crypto from "node:crypto";
import express from "express";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const adminPassword = process.env.ADMIN_PASSWORD;
const tokenSecret = process.env.TOKEN_SECRET;
const googleAppsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
const googleAppsScriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
const publicApiUrl = (process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, "");
const mediaCache = new Map();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined,
});

if (!adminPassword || !tokenSecret || !process.env.DATABASE_URL) {
  throw new Error("Set ADMIN_PASSWORD, TOKEN_SECRET, and DATABASE_URL.");
}
if (Boolean(googleAppsScriptUrl) !== Boolean(googleAppsScriptSecret)) {
  throw new Error("Set both GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_SECRET, or leave both unset.");
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// Audio is stored as a data URL in the book JSON, which adds roughly 33% to
// the original file size when it is base64 encoded.
app.use(express.json({ limit: "100mb" }));

function sign(payload) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", tokenSecret).update(value).digest("base64url");
  return `${value}.${signature}`;
}

function isAdmin(req, res, next) {
  const [value, signature] = (req.get("authorization") || "").replace(/^Bearer\s+/i, "").split(".");
  if (!value || !signature) return res.status(401).json({ error: "Admin login required." });
  const expected = crypto.createHmac("sha256", tokenSecret).update(value).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { actual = Buffer.alloc(0); }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: "Admin session is invalid. Sign in again." });
  }
  try {
    const session = JSON.parse(Buffer.from(value, "base64url").toString());
    if (session.exp < Date.now()) return res.status(401).json({ error: "Admin session expired. Sign in again." });
  } catch {
    return res.status(401).json({ error: "Admin session is invalid. Sign in again." });
  }
  next();
}

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reader_users (
    username TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reading_progress (
    username TEXT NOT NULL REFERENCES reader_users(username) ON DELETE CASCADE,
    book_id TEXT NOT NULL,
    page_index INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, book_id)
  )`);
}

function normalizeReaderCredentials(body) {
  const username = String(body?.username || "").trim();
  const phone = String(body?.phone || "").replace(/[^+0-9]/g, "");
  if (!/^[\w .-]{2,40}$/.test(username) || !/^\+?[0-9]{7,15}$/.test(phone)) {
    throw new Error("Enter a username and valid phone number.");
  }
  return { username, phone };
}
function normalizeUsername(value) {
  const username = String(value || "").trim();
  if (!/^[\w .-]{2,40}$/.test(username)) throw new Error("Invalid username.");
  return username;
}

async function googleStorageRequest(action, book, fileId) {
  const response = await fetch(googleAppsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, secret: googleAppsScriptSecret, ...(book ? { book } : {}), ...(fileId ? { fileId } : {}) }),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || `Google storage request failed (${response.status}).`);
  }
  return result;
}

async function googleUserRequest(action, data) {
  const response = await fetch(googleAppsScriptUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, secret: googleAppsScriptSecret, ...data }), signal: AbortSignal.timeout(30000) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.error || "Account storage request failed.");
    if (action === "login") error.status = 401;
    else if (action === "register") error.status = /already registered/i.test(error.message) ? 409 : 400;
    throw error;
  }
  return result;
}

app.post("/api/users/:action", async (req, res, next) => {
  try {
    const action = req.params.action;
    if (!["register", "login"].includes(action)) return res.status(404).end();
    if (googleAppsScriptUrl) return res.json(await googleUserRequest(action, req.body || {}));
    const { username, phone } = normalizeReaderCredentials(req.body);
    if (action === "register") {
      await pool.query("INSERT INTO reader_users (username, phone) VALUES ($1, $2)", [username, phone]);
    } else {
      const { rows } = await pool.query("SELECT username FROM reader_users WHERE lower(username) = lower($1) AND phone = $2", [username, phone]);
      if (!rows.length) return res.status(401).json({ error: "Username or phone number is incorrect." });
      return res.json({ ok: true, user: { username: rows[0].username } });
    }
    res.json({ ok: true, user: { username } });
  } catch (error) {
    // Account validation and credential failures are expected client errors;
    // don't turn them into the generic 500 shown by the global handler.
    if (/username or phone number is incorrect/i.test(error.message)) {
      return res.status(401).json({ error: error.message });
    }
    if (/enter a username|already registered/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});
app.post("/api/progress", async (req, res, next) => {
  try {
    if (googleAppsScriptUrl) return res.json(await googleUserRequest("progress", req.body || {}));
    const username = normalizeUsername(req.body?.username);
    const bookId = String(req.body?.bookId || "").trim();
    const pageIndex = Math.max(0, Math.floor(Number(req.body?.pageIndex) || 0));
    if (!bookId) return res.status(400).json({ error: "Invalid reading progress." });
    const result = await pool.query("UPDATE reading_progress SET page_index = $3, updated_at = NOW() WHERE username = $1 AND book_id = $2 RETURNING username", [username, bookId, pageIndex]);
    if (!result.rowCount) await pool.query("INSERT INTO reading_progress (username, book_id, page_index) SELECT username, $2, $3 FROM reader_users WHERE lower(username) = lower($1) ON CONFLICT (username, book_id) DO UPDATE SET page_index = EXCLUDED.page_index, updated_at = NOW()", [username, bookId, pageIndex]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});
app.get("/api/progress/:username", async (req, res, next) => {
  try {
    if (googleAppsScriptUrl) return res.json(await googleUserRequest("getProgress", { username: req.params.username }));
    const username = normalizeUsername(req.params.username);
    const { rows } = await pool.query("SELECT book_id AS \"bookId\", page_index AS \"pageIndex\", updated_at AS \"updatedAt\" FROM reading_progress WHERE lower(username) = lower($1) ORDER BY updated_at DESC", [username]);
    res.json({ ok: true, progress: rows });
  } catch (error) { next(error); }
});

async function listBooks() {
  if (googleAppsScriptUrl) {
    const books = (await googleStorageRequest("list")).books;
    return books.map((book) => ({
      ...book,
      pages: (book.pages || []).map((page) => {
        const fileId = getDriveFileId(page.audioUrl);
        return fileId ? { ...page, audioUrl: `${publicApiUrl}/api/media/${encodeURIComponent(fileId)}` } : page;
      }),
    }));
  }
  const { rows } = await pool.query("SELECT data FROM books ORDER BY updated_at DESC");
  return rows.map((row) => row.data);
}

function getDriveFileId(value) {
  const url = String(value || "");
  const queryId = url.match(/[?&]id=([^&]+)/)?.[1];
  const pathId = url.match(/\/d\/([^/?]+)/)?.[1];
  // Playback URLs are proxied through this API so the browser gets byte-range
  // support. Keep recognizing that proxy URL when an edited book is saved.
  const proxyId = url.match(/\/api\/media\/([\w-]{20,})(?:[?#]|$)/)?.[1];
  const id = queryId || pathId || proxyId || "";
  try { return decodeURIComponent(id); } catch { return ""; }
}

app.get("/health", (_req, res) => res.json({ ok: true, storage: googleAppsScriptUrl ? "google" : "postgres" }));
app.get("/api/books", async (_req, res, next) => {
  try {
    res.json({ books: (await listBooks()).filter((book) => !book.isHidden) });
  } catch (error) { next(error); }
});

app.get("/api/admin/books", isAdmin, async (_req, res, next) => {
  try { res.json({ books: await listBooks() }); }
  catch (error) { next(error); }
});

app.get("/api/media/:fileId", async (req, res, next) => {
  try {
    const fileId = String(req.params.fileId || "");
    if (!/^[\w-]{20,}$/.test(fileId)) return res.status(400).json({ error: "Invalid media file ID." });
    let media = mediaCache.get(fileId);
    if (!media) {
      const result = await googleStorageRequest("media", undefined, fileId);
      const extension = String(result.fileName || "").split(".").pop().toLowerCase();
      const mimeByExtension = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac" };
      const reportedMime = String(result.mimeType || "").toLowerCase();
      media = {
        buffer: Buffer.from(result.base64, "base64"),
        mimeType: mimeByExtension[extension] || (reportedMime.startsWith("audio/") ? reportedMime : "application/octet-stream"),
      };
      if (!media.mimeType.startsWith("audio/")) return res.status(415).json({ error: "The Drive file is not a recognized audio file. Use MP3, WAV, or M4A." });
      if (mediaCache.size >= 8) mediaCache.delete(mediaCache.keys().next().value);
      mediaCache.set(fileId, media);
    }

    const { buffer, mimeType } = media;
    res.set("Content-Type", mimeType).set("Accept-Ranges", "bytes").set("Cache-Control", "public, max-age=300");
    const range = req.get("range");
    if (!range) return res.set("Content-Length", buffer.length).send(buffer);
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) return res.status(416).set("Content-Range", `bytes */${buffer.length}`).end();
    const start = match[1] ? Number(match[1]) : Math.max(0, buffer.length - Number(match[2]));
    const end = match[2] ? Math.min(Number(match[2]), buffer.length - 1) : buffer.length - 1;
    if (start >= buffer.length || start > end) return res.status(416).set("Content-Range", `bytes */${buffer.length}`).end();
    res.status(206)
      .set("Content-Range", `bytes ${start}-${end}/${buffer.length}`)
      .set("Content-Length", end - start + 1)
      .send(buffer.subarray(start, end + 1));
  } catch (error) { next(error); }
});

app.post("/api/admin/login", (req, res) => {
  const supplied = String(req.body?.password || "");
  const expected = Buffer.from(adminPassword);
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: "Incorrect admin password." });
  }
  res.json({ token: sign({ exp: Date.now() + 12 * 60 * 60 * 1000 }) });
});

app.put("/api/books/:id", isAdmin, async (req, res, next) => {
  try {
    const book = req.body?.book;
    if (!book || String(book.id) !== req.params.id || !String(book.title || "").trim() || !String(book.bookType || "").trim()) {
      return res.status(400).json({ error: "A book with a matching ID, title, and book type is required." });
    }
    if (!googleAppsScriptUrl && (book.pages || []).some((page) => String(page.audioUrl || "").startsWith("data:audio/"))) {
      return res.status(503).json({ error: "Audio uploads require Google Drive storage. Configure GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_SECRET on the API service, then redeploy." });
    }
    if (googleAppsScriptUrl) await googleStorageRequest("save", book);
    else await pool.query(
      "INSERT INTO books (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()",
      [book.id, JSON.stringify(book)],
    );
    res.json({ books: await listBooks() });
  } catch (error) { next(error); }
});

app.delete("/api/books/:id", isAdmin, async (req, res, next) => {
  try {
    if (googleAppsScriptUrl) await googleStorageRequest("delete", { id: req.params.id });
    else await pool.query("DELETE FROM books WHERE id = $1", [req.params.id]);
    res.json({ books: await listBooks() });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  res.status(status).json({ error: status < 500 ? error.message : "The API could not complete the request." });
});

await ensureSchema();
app.listen(port, "0.0.0.0", () => console.log(`Khmer Reader API listening on ${port}`));
