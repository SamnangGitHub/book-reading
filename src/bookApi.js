const apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");

export const apiConfigured = Boolean(apiUrl);

async function request(path, options = {}) {
  if (!apiUrl) throw new Error("Set VITE_API_URL to your Render API URL and rebuild the app.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `API request failed (${response.status}).`);
  return result;
}

export async function loadBooks() {
  const result = await request("/api/books");
  return result.books;
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
  const result = await request(`/api/books/${encodeURIComponent(book.id)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ book }),
  });
  return result.books;
}

export async function deleteBook(bookId, token) {
  const result = await request(`/api/books/${encodeURIComponent(bookId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return result.books;
}
