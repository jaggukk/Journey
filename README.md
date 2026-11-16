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
- No accounts, analytics, or external application database.
- To move an existing browser-only journal into this version, open the old version, use
  **Export backup**, then use **Import backup…** in the Node version. Browsers do not allow a
  server on `localhost` to read IndexedDB data saved under a different origin.
- `data/` is ignored by Git. Export a backup now and then.

### Server configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `127.0.0.1` | Interface to bind; use `0.0.0.0` to allow LAN access |
| `JOURNEY_DATA_DIR` | `./data` | Journal storage directory |
| `JOURNEY_REQUEST_LIMIT` | `100mb` | Maximum JSON request size |

The server has no authentication. Keep the default loopback host unless you intentionally
want other devices on your network to reach it.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Server and storage health |
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
src/journal-store.js       Atomic on-disk journal storage
src/validation.js          Server-side state and document validation
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
