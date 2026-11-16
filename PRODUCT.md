# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: plain HTML, CSS, and JavaScript with no build step, so the site opens directly from disk. Data is stored locally in IndexedDB with a localStorage fallback.

## Users

One person, using their own computer as a private place to keep a personal record: notes, images, and small collections of work. The site may also be opened on a phone.

## Product Purpose

A journal that looks and behaves like a small desktop file browser. The owner can make folders, write and format notes, add pictures, and keep everything in one place. Success means adding an entry feels as immediate as dropping a file into a folder, and the record survives closing the browser.

## Positioning

A personal archive that is navigated and edited through a faithful, tactile window manager rather than a conventional blog or notes list.

## Operating Context

Desktop-first, monochrome, quiet. The visitor opens files from a tree, arranges windows, and writes directly in a note. Everything is local to the browser and requires no account.

## Capabilities and Constraints

- Create, rename, and delete folders, notes, and image files.
- Rich-text notes with headings, bold/italic/underline, lists, links, quotes, and inline images.
- Drag in or upload images; view them in their own window.
- Add Google Fonts styles by pasting an `@import` / `<style>` snippet or a font name; choose fonts per selection in notes.
- Drag, resize, minimize, maximize (double-click title bar), and close windows.
- Export and import a JSON backup; no server, no accounts, no analytics.
- Demo/starter content is editable and is not a claim about the owner's real life.

## Brand Commitments

The supplied screenshot is the visual reference: near-black ground, hairline rule under a centered lowercase wordmark, light-grey window chrome, 1px borders, monochrome file icons, and a utilitarian sans-serif. The interaction model should stay recognisably a file browser.

## Evidence on Hand

Reference screenshot at `C:\Users\USER\OneDrive\Pictures\Screenshots\Screenshot 2026-11-16 105758.png`. No real personal content, photos, or claims were supplied; starter content must stay clearly replaceable.

## Product Principles

1. The file tree is the source of truth; every object is a file or folder first.
2. The interface should feel like a working desktop, not a picture of one.
3. Writing and adding images should never require leaving the note window.
4. Local data is the owner's data: make backup obvious, avoid lock-in.
5. Keep the chrome quiet so the writing stays loud.

## Accessibility & Inclusion

Keyboard access to the file tree, windows, controls, and dialogs; visible focus; reduced-motion support; contrast for body text; windows remain usable at phone widths.
