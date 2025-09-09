# FLYMILY — Timeline List Redesign

This build updates the opening page to a **timeline-style list**:
- Trips are displayed as rows on a vertical timeline (not cards).
- Dates are emphasized, with a compact 3‑dots action menu (⋮) for **Edit** / **Delete**.
- Chronological sorting (by start/end/updated/created), with asc/desc toggle.
- Mobile-friendly and RTL-ready (Hebrew).

## Files
- `index.html` — New list page.
- `style.css` — Timeline styles and theme (dark/light).
- `script.js` — Rendering + CRUD wiring (works with Firebase or local storage).
- `firebase.js` — Your original Firebase bootstrap (kept as provided).

## Using Firebase (optional)
The page expects Firebase v8 compat builds (already linked in `index.html`).
If you don't want Firebase, the app falls back to **local storage** and seeds demo data.

## Run
Just open `index.html` in a browser. For auth-backed data, serve via HTTPS and valid Firebase config.

## Notes
- Action buttons are moved behind a clean ⋮ menu to reduce visual noise.
- The list is accessible (keyboard-friendly, aria-live for list).