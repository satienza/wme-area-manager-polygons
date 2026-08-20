## What it does

WME Area Manager draws a rectangle or a free-form polygon centered on the point(s) you click in the **Waze Map Editor**, sized (for rectangles) according to your editor rank/level — zoom and area are set automatically, no manual configuration. For free-form polygons, it checks the traced area against your level's maximum and flags it green/red. It also lets you save named shapes for later use (edit, rename, delete, and copy their link, GeoJSON, or WKT straight to the clipboard).

**Intended for Waze editors in Spain (WME España)**.

## Features

- Rectangle mode: one click on the map places a rectangle centered on that point, sized from your editor rank.
- Polygon mode: trace a free-form polygon vertex by vertex; area is validated live against your level's limit, with a label on the shape showing the current area and percentage of the limit. While dragging the whole shape, vertices and the label are hidden in favor of a drag-indicator icon and a gray fill/outline.
- Save shapes with a name; edit, rename, or delete them from the sidebar panel.
- Copy a saved shape's link (`lat`/`lon`/`zoomLevel`), GeoJSON, or WKT straight to the clipboard with one click.
- No changes are ever saved to the live Waze map — it's a visual/reference layer only.

## Requirements

- Tampermonkey (or compatible userscript manager).
- Works on `waze.com/editor`.
