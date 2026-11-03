const endpoint = import.meta.env.VITE_GOOGLE_SCRIPT_URL?.trim();

export const googleStorageConfigured = Boolean(endpoint);

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = `readerCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => finish(new Error("Google Sheets request timed out.")), 20000);
    const finish = (error, value) => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      error ? reject(error) : resolve(value);
    };
    window[callbackName] = (value) => finish(null, value);
    script.onerror = () => finish(new Error("Could not reach the Google Sheets app. Check the deployment URL and access settings."));
    const query = new URLSearchParams({ ...params, callback: callbackName });
    script.src = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query}`;
    document.head.appendChild(script);
  });
}

export async function loadBooks() {
  if (!endpoint) return null;
  const result = await jsonp({ action: "list" });
  if (!result?.ok) throw new Error(result?.error || "Could not load books from Google Sheets.");
  return result.books;
}

export async function saveBook(book) {
  if (!endpoint) return book;
  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "save", book }),
  });
  // The Apps Script response is cross-origin and opaque. Confirm the saved
  // metadata and page text through the read endpoint before reporting success.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 900 : 1200));
    const books = await loadBooks();
    const stored = books.find((item) => item.id === book.id);
    const pagesMatch = stored?.pages?.length === book.pages.length && stored.pages.every((page, index) =>
      page.originalText === book.pages[index].originalText && page.khmerText === book.pages[index].khmerText
    );
    if (stored?.title === book.title && stored?.author === book.author && pagesMatch) return books;
  }
  throw new Error("Google Sheets did not confirm the saved book. Check the Apps Script deployment permissions.");
}
