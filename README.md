# journey

A small, private desktop for notes, pictures, and font styles. It looks and behaves like a
file browser: files on the left, documents in their own windows, everything saved in the
browser on this computer.

## Open it

Double-click `index.html`. There is no build step and no server to run.

Chrome, Edge, and Firefox are the best options. Everything is stored locally in IndexedDB
(with a localStorage fallback), so the same browser remembers your work; a different browser
or a private window starts fresh.

> If a browser blocks local storage for pages opened from disk, journey still runs but
> cannot save. It will say so on load. Use **Export backup** before closing if that happens.

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
- Paste or drop images straight into the text. They are compressed and stored with the note.
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
The export is a single JSON file containing the tree, every note, and every picture.

## Your data

- Stored per browser, on this machine, under the IndexedDB database `journey-db`.
- No server, no accounts, no analytics.
- Clearing site data for this page deletes the journal, so export a backup now and then.
- Starter notes, the mock folder tree, and the sample artwork are demo content. Edit or
  delete all of it.

## Files

```
index.html                 entry point
styles.css                 all visual styling
js/core.js                 icons, helpers, IndexedDB/localStorage, autosave
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
