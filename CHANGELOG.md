# Changelog

All notable changes to this project are documented here, one entry per released version. Versions follow `package.json` (single source of truth, injected into the userscript header at build time).

## 0.15.0 — Copy to clipboard on Link/WKT/GeoJSON

- The "Enlace", "WKT" and "GeoJSON" buttons on each saved entry now copy their result directly to the clipboard, showing a notice next to the buttons that clears after a couple of seconds. If the clipboard write fails, a prompt dialog opens pre-filled with the text so it can be copied manually.
- Removed the URL field and export textarea from the "Forma actual" section — both are unused now that all three buttons copy directly. The URL field's live autofill (while placing/editing a shape, before saving) is also removed; to get a link, save the shape first and use the entry's "Enlace" button.

Closes [#20](https://forgejo.petricor.net/Petricor/wme-area-manager/issues/20).

## 0.14.1 — Confirm before losing unsaved changes on "Edit" or "Clear drawing"

- "Edit" (switching to another saved item) and "Clear drawing" now warn before discarding unsaved changes in the shape being edited: OK continues with the requested action and discards them; Cancel aborts the action and keeps the current edit untouched.
- Replaces the previous "Edit" dialog, whose Cancel didn't actually stop the switch — it only skipped saving, with no way to abort. There's no more implicit save option; changes must be saved explicitly via "Save".

Fixes [#18](https://forgejo.petricor.net/Petricor/wme-area-manager/issues/18).

## 0.14.0 — Hide vertices/label during whole-shape drag

- While dragging a whole shape (rectangle or free-form polygon), vertices and the area/percentage label (#13) are now hidden and replaced by a drag-indicator icon at the shape's center. Fill and outline switch to light gray while dragging (internal toggle, on by default) instead of the usual green/red validity color.

Closes [#15](https://forgejo.petricor.net/Petricor/wme-area-manager/issues/15).

## 0.13.0 — Live area/limit label on the polygon being edited

- Editing a free-form polygon now shows a label centered on the shape with its current area and percentage of the level's limit (e.g. "119,1 (98.02%)"), recalculated live on every vertex change — including while dragging, not just on drop. Text color follows validity (green within the limit, red over it), matching the fill/outline.
- Not shown while editing a rectangle, since its area is fixed by the editor level.

Closes [#13](https://forgejo.petricor.net/satienza/wme-area-manager/issues/13).

## 0.12.1 — Fix "Clear drawing" leaving stale link/name/export data

- "Clear drawing" now also clears the link, name, status and export fields, and drops the in-memory current-shape state (`currentEntry`, `savedSnapshot`) — previously only the drawn layer was cleared, so pressing "Save" afterwards could silently re-save the discarded geometry under whatever name was left in the field.
- The same reset now applies when deleting the item currently being edited.

Fixes [#10](https://forgejo.petricor.net/satienza/wme-area-manager/issues/10).

## 0.12.0 — Rework saved item editing

- Removed the read-only "Load" action for saved items — "Edit" already loads the shape (and centers/zooms the map on it) and lets you modify it directly.
- Only one item can be edited at a time: clicking "Edit" on another item while there are unsaved changes now asks whether to save first (OK saves, Cancel discards) before loading the newly selected item either way.
- "New item" controls (shape/aspect-ratio selectors, "Place rectangle/polygon" button, polygon edit help, delete-vertex shortcut config) are now disabled while a shape is being placed or edited.

Closes [#8](https://forgejo.petricor.net/satienza/wme-area-manager/issues/8).

## 0.11.2 — Split "New item" from "Current shape"

- Sidebar now has a separate "New item" section for placing a shape (shape/aspect-ratio selectors, polygon edit help, delete-vertex shortcut config, "Place rectangle/polygon" button), leaving "Current shape" with just the state of the placed/loaded figure (status, link, name, save, clear, export). Closes [#6](https://forgejo.petricor.net/satienza/wme-area-manager/issues/6).

## 0.11.1 — Latitude-correct drag translation

- Dragging a rectangle or free-form polygon no longer changes its geodesic area depending on latitude (it used to inflate moving south, shrink moving north). Whole-figure translation now rescales the longitude offset by `cos(anchor lat)/cos(current lat)` instead of applying the same raw degree delta everywhere — a degree of longitude spans a different real-world distance depending on latitude, while a degree of latitude doesn't. Fixes [#4](https://forgejo.petricor.net/satienza/wme-area-manager/issues/4).

## 0.11.0 — Restricted vertex editing by shape type

- Rectangles are now rigid in edit mode: only whole-figure translation is allowed, no adding, moving individually, or deleting vertices — that stays exclusive to free-form polygons. Fixes [#2](https://forgejo.petricor.net/satienza/wme-area-manager/issues/2).
- `PolygonLayer.draw()` gains an `editable` flag; saved entries now persist `tipo: 'rectangle' | 'polygon'` (`src/storage.js`) so "Editar" applies the right behavior. Entries saved before this field existed default to editable, unchanged from before.
- Placing a new rectangle now goes straight into the same visual edit mode as a polygon (green/red fill by area validity) instead of a separate read-only preview layer with a magenta outline and center diagonals — no more save-then-reopen just to move it.
- Removed the now-unused `RectangleLayer` (`src/map-layer.js`) and `buildDiagonals` (`src/geometry.js`).
- The panel footer now shows the running script version (`v{package.json version}`), to avoid mistaking a stale cached copy in the browser for a bug.

## 0.10.0 — Packaging

- `package.json` is now the single source of truth for the version; `build.js` injects it into `src/header.js` at compile time instead of it being hand-edited.
- `@updateURL`/`@downloadURL` added to the userscript header, pointing to the GitHub mirror's raw file, for Tampermonkey autoupdate and the Greasyfork listing sync.
- `dist/wme-area-manager.user.js` is now tracked in the repo instead of gitignored, since it's the file served by the raw URL above.
- `npm version` now runs the build and stages `dist/` via its `version` lifecycle script, so a release is a single `npm version <patch|minor|major>` command.

## 0.9.0 — Interface

- Sidebar split into "Current shape" / "Saved" sections with a single injected `<style>` block.
- Font Awesome icons on save/edit/delete/rename/copy-link buttons (reusing WME's own bundled Font Awesome).
- Abbreviated level label in the saved list ("N4" instead of "level 4").
- Vertex being dragged is highlighted with a distinct color until released.

## 0.8.1 — Locale detection

- Language now detected from `sdk.Settings.getLocale()` (WME's own UI language) instead of the browser's `navigator.language`.

## 0.8.0 — Polish and validation

- Reliable `env` detection for the generated link, defaulting to `row`.
- Verified `rank` → level 1-5 mapping against real accounts of different levels.
- Error handling around SDK API calls (missing layers, corrupted `GM_getValue` data, etc.).
- In-panel instructions explaining the point-editing model from 0.6.0.
- Configurable vertex-delete shortcut key, persisted and re-registered via `Shortcuts`.

## 0.7.5 — English translation

- English strings added to the `src/i18n.js` dictionary alongside Spanish.

## 0.7.0 — i18n infrastructure

- `src/i18n.js`: dictionary + `t()` lookup function, starting with Spanish only.
- Hardcoded literals in `src/sidebar.js` migrated to `t('key')`.

## 0.6.0 — Point editing

- Add a vertex by clicking an edge, drag the whole shape by clicking its fill, drag a single vertex, delete a vertex by hovering it and pressing the configured shortcut key.

## 0.5.0 — Manual dragging

- Rigid translation drag (click to pick up, click to drop) for both rectangles and free-form polygons, preserving the exact traced geometry.

## 0.4.0 — Panel management

- Saved-shapes list with load/center, edit, export (GeoJSON/WKT), copy-link, rename and delete actions, backed by a read-only `SavedShapeLayer`.

## 0.3.0 — Persistence

- Save/load rectangles and polygons by name via `GM_setValue`/`GM_getValue`, storing the exact traced geometry.
- GeoJSON/WKT export helpers in `src/geometry.js`.

## 0.2.0 — Free-form polygon mode

- Polygon tracing via `Map.drawPolygon()`, area validation against the editor level's limit, vertex deletion by click.

## 0.1.0 — Minimal prototype

- SDK initialization, sidebar tab, click-to-place rectangle sized from editor rank, geodesic square calculation, link to the center point.
