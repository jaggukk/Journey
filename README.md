# journey

A small, private desktop for notes, pictures, and font styles. It looks and behaves like a
file browser: files on the left, documents in their own windows, and everything saved by a
local Node.js server.

## Run it

Requires Node.js 20 or newer.

```powershell
npm install
npm start
```

Open <http://127.0.0.1:3000>.

For development with automatic server restarts:

```powershell
npm run dev
```

The server listens on `127.0.0.1` by default, so it is only reachable from this computer. To
run tests:

```powershell
npm test
```

## What you can do

**Files** — the window on the left is the source of truth.

- Footer buttons: new folder, new note, add pictures, font styles, more.
- Right-click any row (or use the `⋯` button) for new note/folder, rename, delete.
- Drag an image, `.txt`, or `.md` file onto the tree to add it to the current folder.
- Keyboard: arrow keys move, `Enter` opens, `F2` renames, `Delete` deletes.

**Notes** — click a note name to open it in a window.

- Click a title bar to drag, drag the bottom-right corner to resize, double-click the title
  bar to fill the screen.
- Toolbar: text style, font, bold/italic/underline, lists, links, insert picture, font styles.
- Paste or drop images straight into the text. They are compressed and saved with the note.
- `Ctrl/⌘ + S` saves immediately (it also autosaves while you type).

**Pictures** — adding an image also creates a file in the tree. Opening it shows the picture
in its own window with dimensions, format, and a download link.

**Font styles** — click `Aa` (in the note toolbar or the files footer).

Paste any of these and press **Add font style**:

```
<style>
@import url('https://fonts.googleapis.com/css2?family=Shadows+Into+Light&display=swap');
</style>
```

```
@import url('https://fonts.googleapis.com/css2?family=Indie+Flower&display=swap');
```

```
https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap
```

```
Abril Fatface
```

The first URL's `family=` is read automatically and the font is added to every note's font
menu. Bare names are looked up on Google Fonts. Fonts need an internet connection the first
time; the browser caches them afterwards.

**Backups** — the `⋯` menu in the files footer has **Export backup** and **Import backup…**.
The export is a single JSON file containing the tree, every note, and every picture. Imports
replace the complete journal in one server-side operation.

## Your data

- Stored on this machine in `data/generations/`, managed by the Node server.
- The server writes state and document files atomically and keeps backups hidden from the
  static web routes.
- No accounts, analytics, or external application database. Editing is protected by the single
  admin username/password in `.env`.
- To move an existing browser-only journal into this version, open the old version, use
  **Export backup**, then use **Import backup…** in the Node version. Browsers do not allow a
  server on `localhost` to read IndexedDB data saved under a different origin.
- `data/` is ignored by Git. Export a backup now and then.

### Store notes and pictures in Neon Postgres

By default everything lives in `./data` on this machine. To keep notes and pictures in a
database instead (required on Vercel, optional locally):

1. Create a free database at <https://console.neon.tech> — or in Vercel, open **Storage** and
   add **Neon**.
2. Copy the connection string (the pooled one, ending in `?sslmode=require`).
3. Paste it into `.env`:

   ```powershell
   DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require
   ```

4. Check the connection and create the tables:

   ```powershell
   npm run db:check
   ```

5. Optional: copy the journal that is currently in `./data` into the database.

   ```powershell
   npm run db:import
   ```

6. Restart the server with `npm start` (or `npm run dev`). The startup line now says
   `journey data is stored in Neon.`

The tables are created automatically; no SQL is needed:

- `journey_state` — one JSON row with the file tree, fonts, and window state.
- `journey_docs` — one row per note or picture. Notes hold HTML, pictures hold base64 data
  URLs, so the database contains the complete journal (keep pictures under ~3 MB each).

On Vercel, add `DATABASE_URL`, `JOURNEY_ADMIN_USERNAME`, `JOURNEY_ADMIN_PASSWORD`, and
`JOURNEY_SESSION_SECRET` under **Settings → Environment Variables**. The `.env` file is not
read there, and `./data` is not persistent.

### Deploy to Vercel

`vercel.json` already serves `public/` and routes `/api/*` to `api/[...path].js`, and
`.vercelignore` keeps `.env`, `data/`, and tests out of the upload.

1. Deploy with `npx vercel` (or connect the repository in the Vercel dashboard).
2. Add the four variables above in the project settings, then redeploy.
3. Open the deployment and sign in from the gear menu.

Vercel functions accept request and response bodies up to 4.5 MB. Picture records are well
below that after browser compression, and journal reads are streamed so a growing journal is
not cut off. To restore a backup larger than 4.5 MB, run the server locally (it uses the same
`DATABASE_URL`) and use **Import backup…** there.

By default, reading a journal is open: anyone with the deployment URL can read notes and
pictures; only changes require signing in. Do not deploy a private journal to a public URL
unless that is intended.

### Server configuration

Settings live in `.env` (created next to `package.json`; it is ignored by git). Restart the
server after changing them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `JOURNEY_ADMIN_USERNAME` | `admin` | Username for editing the journal |
| `JOURNEY_ADMIN_PASSWORD` | `journey` locally | Password for editing the journal |
| `JOURNEY_ADMIN_PASSWORD_HASH` | — | SHA-256 hex of the password, instead of the plain password |
| `JOURNEY_SESSION_SECRET` | password value | Secret that signs the sign-in cookie |
| `DATABASE_URL` | — | Neon Postgres connection string; enables database storage |
| `PORT` | `3000` | HTTP port |
| `HOST` | `127.0.0.1` | Interface to bind; use `0.0.0.0` to allow LAN access |
| `JOURNEY_DATA_DIR` | `./data` | Journal storage directory |
| `JOURNEY_REQUEST_LIMIT` | `100mb` | Maximum JSON request size |

Reading is open; creating, editing, deleting, importing, and uploading require signing in from
the gear menu. If no credentials are configured, the local server falls back to `admin` /
`journey`; a production deployment with no credentials is read-only. Keep the default loopback
host unless you intentionally want other devices on your network to reach it.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Server and storage health |
| `POST` | `/api/auth/login` | Sign in with the admin username and password |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/state` | File tree, fonts, and window state |
| `PUT` | `/api/state` | Save the file tree and UI state |
| `GET` | `/api/docs` | Read every note and image record |
| `PUT` | `/api/docs/:id` | Save one note or image record |
| `DELETE` | `/api/docs` | Delete records by ID |
| `GET` | `/api/journal` | Read state and documents together |
| `POST` | `/api/import` | Atomically replace the complete journal |

## Files

```
package.json               Node project and scripts
src/server.js              HTTP server startup and configuration
src/app.js                 Express routes and static assets
src/env.js                 Loads .env into process.env
src/auth.js                Admin username/password sign-in and sessions
src/store.js               Chooses Neon or on-disk storage
src/journal-store.js       Atomic on-disk journal storage
src/neon-store.js          Neon Postgres journal storage
src/validation.js          Server-side state and document validation
scripts/db.js              npm run db:check / db:import helpers
test/api.test.js           API and storage tests
index.html                 browser entry point
styles.css                 all visual styling
js/core.js                 icons, helpers, API client, autosave
js/data.js                 starter content, state normalization, HTML sanitizer
js/ui.js                   dialogs, context menus, toasts
js/windows.js              window manager (drag, resize, minimize, maximize, permalinks)
js/notes.js                note editor and formatting toolbar
js/media.js                image preparation, uploads, image viewer
js/fonts.js                bundled fonts + Google Fonts import manager
js/files.js                file tree, create/rename/delete, drag-and-drop
js/backup.js               JSON export/import
js/main.js                 startup and global wiring
assets/monochrome-study.svg  sample artwork
PRODUCT.md                 product notes and assumptions
```
