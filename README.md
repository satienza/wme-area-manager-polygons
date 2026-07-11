# wme-area-manager

Tampermonkey userscript for the Waze Map Editor (WME). Draws a rectangle centered on a point on the map, with area and zoom fixed according to the editor's level, lets you save it with a name and manage saved rectangles from the sidebar, and generates a direct link to the center point.

- Requirements and feasibility analysis: [`requisitos_wme_area_manager.md`](./requisitos_wme_area_manager.md)
- Phased development plan: [`PLAN.md`](./PLAN.md)
- Greasyfork listing text: [`GREASYFORK.md`](./GREASYFORK.md)

## Status

Scaffolding stage. Structure and module stubs created (Phase 0 of the plan); Phase 1 onward still to be implemented.

## Structure

```
src/
  header.js     Userscript metadata header (@name, @match, @grant...)
  index.js      Entry point, SDK initialization
  config.js     Editor level -> zoom/area rule
  geometry.js   Geodesic calculation of the square (Turf.js)
  storage.js    Persistence of saved rectangles (GM_setValue/GM_getValue)
  map-layer.js  Custom SDK layer: drawing and manual dragging
  link.js       Generation of the link to the center point
  sidebar.js    Sidebar panel (UI)
build.js        esbuild bundle -> dist/wme-area-manager.user.js
```

## Development

```bash
npm install
npm run build     # generates dist/wme-area-manager.user.js
npm run watch      # rebuilds on every change
```

To try it out, install `dist/wme-area-manager.user.js` in Tampermonkey and open the WME.

## Pending dependencies

- `@turf/turf` for the geodesic calculation of the square (see `src/geometry.js`).
