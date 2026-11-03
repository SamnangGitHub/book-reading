# Khmer Reader

React book reader and editor. By default it opens with a sample book and keeps new books in the current browser session. To sync books, page text, covers, and audio to Google Sheets and Drive:

## Set up Google storage

1. In [Google Apps Script](https://script.google.com/), create a project and paste in `google-apps-script/Code.gs`.
2. Select `setup` in the function menu and run it once. Approve the requested Sheets and Drive permissions. The script creates a spreadsheet with `Books` and `Pages` tabs, plus a Drive folder for media.
3. Deploy the script as a **Web app** and copy the URL ending in `/exec`.
4. Copy `.env.local.example` to `.env.local`, then put that deployment URL after `VITE_GOOGLE_SCRIPT_URL=`.
5. Restart the dev server (or rebuild and redeploy the site). The library will load from Sheets; saving a book uploads its media to Drive and writes page data to Sheets.

## Access and media privacy

This lightweight Apps Script connector uses JSONP for reads and cross-origin form-style posts for writes. Apps Script web apps that accept these requests generally need broad access, so anyone who gets the deployment URL may be able to read or change this library. Use it only for non-sensitive books and a private site; do not publish the site or deployment URL for a shared library. Uploaded media is set to **Anyone with the link can view** so covers and narration can load in the reader. For private or multi-user libraries, use a backend with Google OAuth and per-user authorization instead.

The Apps Script connector stores each book in `Books` and its page records in `Pages`. Re-saving a book replaces its page rows. New media files are created in the Drive folder; old media is not automatically deleted.

## Run locally

```sh
npm install
npm run dev
```
