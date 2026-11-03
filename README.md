# Khmer Reader

React book reader with a Render hosted Node API and PostgreSQL database. The API serves public book reads and requires a server-side admin password to add or edit books. Book metadata, page text, covers, and audio are stored together as JSON in PostgreSQL.

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and connect the repository. Render reads `render.yaml` to create the API web service, static site, and PostgreSQL database.
3. When prompted, set `ADMIN_PASSWORD` to a strong private password. Render generates `TOKEN_SECRET` for signed admin sessions.
4. Choose a persistent PostgreSQL plan and review its price before confirming. A durable database is needed to keep books across deployments.
5. Wait for both web services to deploy. Open the static site URL; books load from the API, and the first add/edit action prompts for the admin password.

The static site receives the API URL from the Blueprint at build time. If deploying the frontend separately, set `VITE_API_URL` to the API's full `https://...onrender.com` URL, then rebuild the site. Locally, set `VITE_API_URL` in `.env.local` to the API URL and restart Vite.

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

Book reads are public. Adding and editing require a 12-hour signed admin session; the password and signing secret stay on the API service. The API accepts media data URLs up to 25 MB per request and stores them in PostgreSQL. For a large library, move media to object storage.

The previous Google Apps Script library is not imported automatically. Existing books need to be added to the new API separately.
