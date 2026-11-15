const apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");

export const apiConfigured = Boolean(apiUrl);

async function request(path, options = {}) {
  if (!apiUrl) throw new Error("Set VITE_API_URL to your Render API URL and rebuild the app.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `API request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function loadBooks() {
  const result = await request("/api/books");
  return result.books;
}

export async function recordPageVisit(sessionId) {
  return request("/api/visits", { method: "POST", body: JSON.stringify({ sessionId }) });
}

export async function loadPageVisits() {
  return request("/api/visits");
}

export async function loadAdminBooks(token) {
  const result = await request("/api/admin/books", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return result.books;
}

export async function adminLogin(password) {
  const result = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return result.token;
}

export async function saveBook(book, token) {
  let bookToSave = book;
  if (typeof File !== "undefined" && book.fullAudioFile instanceof File) {
    const file = book.fullAudioFile;
    const { uploadId } = await request("/api/full-audio/upload", {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileName: file.name, size: file.size, mimeType: audioMime(file.name) }),
    });
    const chunkSize = 3 * 1024 * 1024;
    let uploadedFileId = "";
    for (let start = 0; start < file.size; start += chunkSize) {
      const end = Math.min(file.size, start + chunkSize);
      const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
      }
      const result = await request(`/api/full-audio/upload/${encodeURIComponent(uploadId)}/chunk`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ start, end: end - 1, base64: btoa(binary) }),
      });
      if (result.complete) uploadedFileId = result.fileId;
    }
    if (!uploadedFileId) throw new Error("Drive did not finish storing the audiobook.");
    bookToSave = { ...book, fullAudioUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(uploadedFileId)}` };
    delete bookToSave.fullAudioFile;
  }
  const result = await request(`/api/books/${encodeURIComponent(book.id)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ book: bookToSave }),
  });
  return result.books;
}

function audioMime(fileName) {
  const extension = String(fileName).split(".").pop()?.toLowerCase();
  return ({ mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" })[extension] || "application/octet-stream";
}

export async function deleteBook(bookId, token) {
  const result = await request(`/api/books/${encodeURIComponent(bookId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return result.books;
}

export async function userAccount(action, credentials) {
  return request(`/api/users/${action}`, { method: "POST", body: JSON.stringify(credentials) });
}
export async function saveReadingProgress(username, bookId, pageIndex) {
  return request("/api/progress", { method: "POST", body: JSON.stringify({ username, bookId, pageIndex }) });
}
export async function loadReadingProgress(username) {
  return request(`/api/progress/${encodeURIComponent(username)}`);
}
