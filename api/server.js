import crypto from "node:crypto";
import express from "express";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const adminPassword = process.env.ADMIN_PASSWORD;
const tokenSecret = process.env.TOKEN_SECRET;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined,
});

if (!adminPassword || !tokenSecret || !process.env.DATABASE_URL) {
  throw new Error("Set ADMIN_PASSWORD, TOKEN_SECRET, and DATABASE_URL.");
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "25mb" }));

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
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/books", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT data FROM books ORDER BY updated_at DESC");
    res.json({ books: rows.map((row) => row.data) });
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
    if (!book || String(book.id) !== req.params.id || !String(book.title || "").trim()) {
      return res.status(400).json({ error: "A book with a matching ID and title is required." });
    }
    await pool.query(
      "INSERT INTO books (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()",
      [book.id, JSON.stringify(book)],
    );
    const { rows } = await pool.query("SELECT data FROM books ORDER BY updated_at DESC");
    res.json({ books: rows.map((row) => row.data) });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "The API could not complete the request." });
});

await ensureSchema();
app.listen(port, "0.0.0.0", () => console.log(`Khmer Reader API listening on ${port}`));
