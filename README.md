# wme-area-manager

Tampermonkey userscript for the Waze Map Editor (WME). Draws a rectangle centered on a point on the map, with area and zoom fixed according to the editor's level, lets you save it with a name and manage saved rectangles from the sidebar, and generates a direct link to the center point.

- Requirements and feasibility analysis: [`requisitos_wme_area_manager.md`](./requisitos_wme_area_manager.md)
- Phased development plan: [`PLAN.md`](./PLAN.md) (archived — phases 0-11 complete; see `CHANGELOG.md` for the release history)
- Greasyfork listing text: [`GREASYFORK.md`](./GREASYFORK.md)
- Release history: [`CHANGELOG.md`](./CHANGELOG.md)

Ongoing work (features, bugs) is tracked via issues and pull requests in the [Forgejo repo](https://forgejo.petricor.net/satienza/wme-area-manager), not via `PLAN.md`.

## Status

Feature-complete, published userscript (v0.12.0 — see `CHANGELOG.md` for details): rectangle and free-form polygon drawing, area validation by editor level, save/load/edit/export of named shapes, i18n, and Greasyfork packaging.

## Structure

```
src/
  header.js             Userscript metadata header (@name, @match, @grant...)
  index.js              Entry point, SDK initialization
  config.js             Editor level -> zoom/area rule
  geometry.js           Geodesic area/shape calculations (Turf.js), GeoJSON/WKT export
  storage.js            Persistence of saved shapes (GM_setValue/GM_getValue)
  polygon-layer.js       Editable layer: drawing, dragging, vertex add/move/delete
  saved-shape-layer.js   Read-only layer for a loaded saved shape
  sdk-safe.js            Defensive wrappers around SDK calls
  i18n.js                Text dictionary and t() lookup
  self-check.js          Lightweight runtime self-tests (npm test)
  link.js                Generation of the link to the center point
  sidebar.js             Sidebar panel (UI)
build.js                 esbuild bundle -> dist/wme-area-manager.user.js
```

## Development

```bash
npm install
npm run build     # generates dist/wme-area-manager.user.js
npm run watch      # rebuilds on every change
```

To try it out, install `dist/wme-area-manager.user.js` in Tampermonkey and open the WME.
