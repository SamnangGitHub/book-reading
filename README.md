# Khmer Reader

React book reader with a Render hosted Node API. The API serves public book reads and requires a server-side admin password to add or edit books. PostgreSQL is the default book store. To use Google Sheets and Drive instead, configure `GOOGLE_APPS_SCRIPT_URL` and `GOOGLE_APPS_SCRIPT_SECRET` on the API service; see [GOOGLE_DRIVE_SHEETS_SETUP.md](GOOGLE_DRIVE_SHEETS_SETUP.md).

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and connect the repository. Render reads `render.yaml` to create the API web service, static site, and PostgreSQL database.
3. When prompted, set `ADMIN_PASSWORD` to a strong private password. Render generates `TOKEN_SECRET` for signed admin sessions.
4. Choose a persistent PostgreSQL plan and review its price before confirming. A durable database is needed to keep books across deployments.
5. Wait for both web services to deploy. Open the static site URL; books load from the API, and the first add/edit action prompts for the admin password.

The static site receives the API URL from the Blueprint at build time. If deploying the frontend separately, set `VITE_API_URL` to the API's full `https://...onrender.com` URL, then rebuild the site. Locally, set `VITE_API_URL` in `.env.local` to the API URL and restart Vite.

## Deploy to GitHub Pages

The `Deploy to GitHub Pages` workflow builds and publishes the site whenever `main` is updated. Before its first run:

1. Deploy the API on Render and copy its public `https://...onrender.com` service URL.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables**, then add a repository variable named `VITE_API_URL` with that URL (no trailing slash).
3. Open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
4. Push to `main` or run the workflow manually from the **Actions** tab.

The API URL is included in the public frontend bundle, so it belongs in a repository variable, not a secret. If the workflow runs without this variable, the site builds but shows the “Book API is not configured” message.

## Run locally

Start PostgreSQL and the API:

```sh
cd api
npm install
$env:DATABASE_URL="postgres://USER:PASSWORD@localhost:5432/khmer_reader"
$env:ADMIN_PASSWORD="choose-a-private-password"
$env:TOKEN_SECRET="use-a-long-random-secret"
npm start
```

In another terminal, configure and start the frontend:

```sh
npm install
```

Create `.env.local` with `VITE_API_URL=http://localhost:3000`, then run `npm run dev`.

## Data and access

Book reads are public. Adding and editing require a 12-hour signed admin session; the password and signing secret stay on the API service. Google storage is only used when both server-side Google environment variables are set; otherwise the API uses PostgreSQL. The API accepts media data URLs up to 100 MB per request. Google Apps Script has its own request and execution limits, so keep uploads modest.

Existing PostgreSQL books are not automatically copied into Google Sheets. Import or re-add them before switching storage if you need to preserve them.
