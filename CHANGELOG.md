# Changelog

All notable changes to this project are documented here, one entry per released version. Versions follow `package.json` (single source of truth, injected into the userscript header at build time).

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
