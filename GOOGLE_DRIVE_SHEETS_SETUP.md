# Connect Khmer Reader to Google Drive and Sheets

This guide describes the Google Apps Script storage already present in `google-apps-script/Code.gs` and how it fits with the Render deployment.

## Important: current storage behavior

The app talks to the Render Node API (`VITE_API_URL`). The API uses PostgreSQL by default. With the integration configured below, the Node API forwards reads and writes to Apps Script; Apps Script stores text and metadata in Sheets and uploaded covers/audio in Drive. PostgreSQL remains provisioned by the Blueprint but is no longer the active book store while Google storage is configured. Existing PostgreSQL books are not copied automatically.

## Google Sheet schema

Running `setup()` in Apps Script creates a spreadsheet named **Khmer Reader Library** with these tabs and header rows. Keep the headers and their order unchanged; the script reads and writes columns by position.

### `Books` tab

| Column | Header | Meaning |
| --- | --- | --- |
| A | `bookId` | Stable book ID, such as `book-123` |
| B | `title` | Original book title |
| C | `titleKhmer` | Khmer title |
| D | `author` | Author name |
| E | `coverImage` | Cover URL; uploaded image files are stored in Drive |

### `Pages` tab

| Column | Header | Meaning |
| --- | --- | --- |
| A | `bookId` | ID of the book that owns the page |
| B | `pageId` | Stable page ID |
| C | `pageNumber` | Display order, starting at 1 |
| D | `originalText` | Original page text |
| E | `khmerText` | Khmer translation |
| F | `audioUrl` | Audio URL; uploaded audio files are stored in Drive |
| G | `audioFileName` | Original audio filename |

The cover image and audio are files in the **Khmer Reader Media** Drive folder when uploaded as data URLs. The Sheet stores their URLs, while page text and metadata live directly in cells. A URL pasted into the cover field stays a URL and is not copied into Drive. Drive cover links are returned as thumbnail URLs. The Render API proxies audio bytes from Drive and serves them with audio MIME types and byte-range support so the reader can play and seek reliably. The Render URL shown in the player is a streaming endpoint; the audio file itself remains in Drive. Saving an existing book preserves this Drive file reference.

Audio uploads require both Google storage environment variables on the API service. If Google storage is not configured, the API rejects audio data URL uploads rather than silently saving them to PostgreSQL. Existing audio that was previously saved in PostgreSQL is not migrated automatically; re-upload those files after configuring Google storage.

## Prepare the Apps Script project

1. Sign in to the Google account that should own the library and media.
2. Open [script.google.com](https://script.google.com) and create a **New project**.
3. Copy the contents of this repository's `google-apps-script/Code.gs` into `Code.gs`, replacing the starter function. The script must include the `doPost` secret check; older versions that allow unauthenticated saves must not be used.
4. Save the project with a recognizable name, such as **Khmer Reader Storage**.
5. In the function selector, choose `setup` and click **Run**.
6. Review the requested Google Sheets and Drive permissions and authorize them.
7. In **Execution log**, open the logged spreadsheet and Drive folder links. Confirm that `Books` and `Pages` exist with the headers above, and that the folder is named **Khmer Reader Media**.

`setup()` stores the spreadsheet and folder IDs in Apps Script project properties. Run it only once for a new project. If you intentionally create a different spreadsheet or folder, update the corresponding `SPREADSHEET_ID` or `DRIVE_FOLDER_ID` in **Project Settings → Script properties**.

## Set the shared secret

1. Generate a long random secret (at least 32 characters). Keep it private.
2. In Apps Script, open **Project Settings → Script properties → Add script property**. Add `INTEGRATION_SECRET` with that secret as its value. Do not put the secret in a Sheet or in React code.
3. Keep the same secret ready for the Render API environment variable in the next section.

## Deploy the Apps Script web app

1. Click **Deploy → New deployment**.
2. Select the gear icon and choose **Web app**.
3. Set **Execute as** to **Me**, so the script can write to the Sheet and Drive folder you created.
4. Set **Who has access** to **Anyone** (or the equivalent public access option), because Render's server calls the web app without a Google user session. Writes and reads are guarded by `INTEGRATION_SECRET`; do not deploy an older unauthenticated version of `Code.gs`.
5. Deploy, authorize if prompted, and copy the URL ending in `/exec`.

The web app URL is not the Render API URL. Do not put it into `VITE_API_URL`: the existing React app expects the Render Node API's `/api/books` endpoints, not the Apps Script protocol.

## Configure Render to use Google storage

In Render, the Blueprint (`render.yaml`) provisions three resources: the static site, the Node API, and PostgreSQL. The static site receives `VITE_API_URL` from the Node API service. The API needs `DATABASE_URL`, `ADMIN_PASSWORD`, and `TOKEN_SECRET`; the Blueprint supplies the database connection and token secret, and prompts for the admin password.

The repository's `render.yaml` defines two private environment variables on the API service. After committing and deploying the updated code:

1. Deploy the repository with **New → Blueprint** in Render.
2. Set a private `ADMIN_PASSWORD` when Render prompts for it.
3. In the Render dashboard open the **`khmer-reader-api`** service, then **Environment**. Add/update:
   - `GOOGLE_APPS_SCRIPT_URL` = the Apps Script deployment URL ending in `/exec`.
   - `GOOGLE_APPS_SCRIPT_SECRET` = the exact same secret saved in Apps Script Script Properties.
4. Save changes and redeploy the API. `VITE_API_URL` stays the Render API URL; do not set it to the Apps Script URL. For audio streaming, deploy the latest `api/server.js` and `google-apps-script/Code.gs` as well.
5. Open `https://<your-api-host>/health`. The response should include `"storage":"google"`.
6. Open the app, add a small test book, then check the `Books` and `Pages` tabs and the Drive media folder.

The Google storage settings are read by the Node API only. Never place the shared secret in a `VITE_*` variable, frontend code, or the Sheet.

## Connecting Render to Google storage

The safe architecture is:

`Browser → Render Node API (admin login) → Apps Script → Google Sheets and Drive`

The Node API handles the app's admin session and forwards book reads and saves to Apps Script using the server-side secret. If either Google environment variable is absent, the API falls back to PostgreSQL. Set both to activate Google storage. Existing PostgreSQL books are not automatically imported; add them again in the app or arrange a one-time migration before switching.

## Verify the connection

1. Open the deployed app and sign in through Upload.
2. Create a test book with a cover, one page of original text, a Khmer translation, and (optionally) audio.
3. Save, refresh the app, and confirm the book and page content reload.
4. Open the `Books` and `Pages` tabs and confirm the matching rows and URLs appear.
5. Open the cover and audio URLs and confirm sharing/access works as intended.
6. Edit the test book and save again; confirm the `Books` row is updated and its `Pages` rows are replaced with the current page list, without duplicate pages.

## Notes

- The current Apps Script makes uploaded Drive files viewable to anyone with the link so that a public reader can display them. Use this only for content you are comfortable making public.
- The app reads the full library as JSON. Audio playback fetches the full audio file from Apps Script the first time, then caches up to eight files in the Render API process. Keep individual audio files modest (for example, under 10 MB); for large libraries, use dedicated media hosting with range support.
- Do not manually reorder or rename the Sheet columns unless you also update the column indexes in `Code.gs`.
