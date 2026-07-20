// Custom SDK layer to draw and edit a free-form polygon, without touching
// WME's DataModel (same approach as RectangleLayer, see map-layer.js).
//
// Three separate features per polygon, stacked in this order (see
// `_redraw()`), so the SDK's own hit-testing — not our own geometry math —
// decides what a click hit: a low-opacity `'fill'` feature covering the
// whole interior (drag the shape), a stroke-only `'outline'` feature on top
// of it (add a vertex — its hit region is a thin band around the line, so
// it wins near the edge), and `vertex-*` point markers on top of both
// (drag/drop a single vertex). This mirrors why vertices were already drawn
// after the outline: an overlapping click resolves to whichever feature is
// on top.
//
// Vertex deletion mirrors WME's own geometry editor: hover the vertex and
// press the configured key (`wme-layer-feature-mouse-enter/leave` tracks
// the hovered vertex, `Shortcuts.createShortcut` registers it — the SDK has
// no native `keydown` event). A left click on a vertex marker instead arms
// a drag of that single point. See requisitos_wme_area_manager.md, section
// 2 (point 5.1).
//
// A click on the outline inserts a new vertex there, at the nearest edge
// (`nearestEdgeIndex`, geometry.js). A click on the fill arms a drag of the
// whole shape.
//
// Dragging (whole shape or a single vertex) is click-to-pick-up / move /
// click-to-drop, not press-and-hold: the public SDK exposes no way to
// disable WME's native map drag-pan, which listens to the same raw mouse
// gesture, so a held-button drag fights the map panning under it. A plain
// click (down+up with no motion in between) never triggers that native pan.
//
// Event order matters here: for a click that lands on a feature,
// `wme-layer-feature-clicked` fires before `wme-map-mouse-down` (see the
// `this.drag` guard below, needed since the *drop* click of a whole-shape
// drag can itself land on a vertex marker). Every action decided in
// `_onFeatureClicked` sets `_suppressMouseDown` so the generic mouse-down
// handler that follows for the same physical click doesn't reinterpret it.
// `wme-layer-feature-clicked` carries no coordinates, so arming a drag or
// inserting a vertex from it uses `this._lastMouse`, the last position seen
// by `wme-map-mouse-move`.

import { nearestEdgeIndex } from './geometry.js';
import { safeAddLayer, safeAddFeature, safeRemoveFeature } from './sdk-safe.js';

const LAYER_NAME = 'wme-area-manager-polygon';
const MIN_POINTS = 3;
const SHORTCUT_ID = 'wme-area-manager-delete-vertex';
export const DEFAULT_DELETE_SHORTCUT_KEY = 'k';

function buildRing(coordinates) {
  return [...coordinates, coordinates[0]];
}

export class PolygonLayer {
  /**
   * @param {string} [deleteShortcutKey] - persisted preference (src/storage.js);
   *   defaults to the key this script has always used.
   */
  constructor(sdk, deleteShortcutKey = DEFAULT_DELETE_SHORTCUT_KEY) {
    this.sdk = sdk;
    safeAddLayer(sdk, {
      layerName: LAYER_NAME,
      styleRules: [
        {
          predicate: (props) => props.role === 'fill' && props.valid,
          style: { fill: true, fillColor: '#2ECC40', fillOpacity: 0.15 },
        },
        {
          predicate: (props) => props.role === 'fill' && !props.valid,
          style: { fill: true, fillColor: '#FF4136', fillOpacity: 0.15 },
        },
        {
          predicate: (props) => props.role === 'outline' && props.valid,
          style: { fill: false, strokeColor: '#2ECC40', strokeWidth: 3 },
        },
        {
          predicate: (props) => props.role === 'outline' && !props.valid,
          style: { fill: false, strokeColor: '#FF4136', strokeWidth: 3 },
        },
        {
          predicate: (props) => props.role === 'vertex' && !props.dragging,
          style: { fillColor: '#FF00FF', fillOpacity: 1, pointRadius: 8 },
        },
        {
          predicate: (props) => props.role === 'vertex' && props.dragging,
          style: { fillColor: '#FFDC00', fillOpacity: 1, pointRadius: 8 },
        },
      ],
    });
    this.sdk.Events.trackLayerEvents({ layerName: LAYER_NAME });
    this.sdk.Events.on({ eventName: 'wme-layer-feature-clicked', eventHandler: this._onFeatureClicked.bind(this) });
    this.sdk.Events.on({ eventName: 'wme-layer-feature-mouse-enter', eventHandler: this._onFeatureMouseEnter.bind(this) });
    this.sdk.Events.on({ eventName: 'wme-layer-feature-mouse-leave', eventHandler: this._onFeatureMouseLeave.bind(this) });
    this.sdk.Events.on({ eventName: 'wme-map-mouse-down', eventHandler: this._onMouseDown.bind(this) });
    this.sdk.Events.on({ eventName: 'wme-map-mouse-move', eventHandler: this._onMouseMove.bind(this) });
    this.shortcutKey = deleteShortcutKey;
    this._registerDeleteShortcut();
    this.featureIds = [];
    this.coordinates = [];
    this.onChange = null;
    // Set from pick-up to drop: the coordinates and mouse position at the
    // moment the drag was armed, so each move applies the *total* delta
    // (no per-frame drift) and dropping is just clearing this.
    this.drag = null;
    // Index of the vertex currently being dragged (click-to-pick-up model,
    // same as `drag` above but for a single point with no delta needed).
    this.vertexDragIndex = null;
    // Index of the vertex currently under the cursor, for the delete shortcut.
    this.hoveredVertexIndex = null;
    // Last known cursor position, used to place a vertex inserted by a click
    // on the outline (`wme-layer-feature-clicked` carries no coordinates).
    this._lastMouse = null;
    // Set when `_onFeatureClicked` already handled a click, so the
    // `wme-map-mouse-down` that follows for the same click (see event-order
    // note up top) doesn't reinterpret it as another action.
    this._suppressMouseDown = false;
  }

  /**
   * @param {GeoJSON.Polygon} polygon - as returned by sdk.Map.drawPolygon().
   * @param {{ onChange: (polygon: GeoJSON.Polygon | null, info?: { error: string }) => void }} handlers
   */
  draw(polygon, { onChange }) {
    this.coordinates = polygon.coordinates[0].slice(0, -1);
    this.onChange = onChange;
    this._redraw();
  }

  // Registers the delete-vertex shortcut under the current `shortcutKey`.
  // Shared by the constructor and `setDeleteShortcutKey` (panel control,
  // Fase 8) so both go through the same try/catch.
  _registerDeleteShortcut() {
    try {
      this.sdk.Shortcuts.createShortcut({
        shortcutId: SHORTCUT_ID,
        shortcutKeys: this.shortcutKey,
        description: 'WME Area Manager: borrar el vértice bajo el cursor',
        callback: this._onDeleteShortcut.bind(this),
      });
    } catch (error) {
      console.warn('WME Area Manager: no se pudo registrar el atajo para borrar vértices.', error);
    }
  }

  /** @param {string} key - single key, persisted by the caller (src/storage.js). */
  setDeleteShortcutKey(key) {
    try {
      this.sdk.Shortcuts.deleteShortcut({ shortcutId: SHORTCUT_ID });
    } catch (error) {
      console.warn('WME Area Manager: no se pudo desregistrar el atajo anterior.', error);
    }
    this.shortcutKey = key;
    this._registerDeleteShortcut();
  }

  setValid(valid) {
    for (const role of ['fill', 'outline']) {
      safeRemoveFeature(this.sdk, LAYER_NAME, role);
      safeAddFeature(this.sdk, LAYER_NAME, {
        id: role,
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [buildRing(this.coordinates)] },
        properties: { role, valid },
      });
    }
  }

  clear() {
    for (const featureId of this.featureIds) {
      safeRemoveFeature(this.sdk, LAYER_NAME, featureId);
    }
    this.featureIds = [];
  }

  _redraw() {
    this.clear();
    const features = [
      {
        id: 'fill',
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [buildRing(this.coordinates)] },
        properties: { role: 'fill', valid: true },
      },
      {
        id: 'outline',
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [buildRing(this.coordinates)] },
        properties: { role: 'outline', valid: true },
      },
      ...this.coordinates.map((coordinate, i) => ({
        id: `vertex-${i}`,
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coordinate },
        properties: { role: 'vertex', pointIndex: i, dragging: i === this.vertexDragIndex },
      })),
    ];
    for (const feature of features) {
      safeAddFeature(this.sdk, LAYER_NAME, feature);
      this.featureIds.push(feature.id);
    }
  }

  _onFeatureClicked({ featureId, layerName }) {
    if (layerName !== LAYER_NAME) return;
    if (this.drag) return; // the click that drops a whole-shape drag isn't another action

    if (featureId === 'fill') {
      if (this.vertexDragIndex != null || !this._lastMouse) return; // dropping a vertex drag, handled by _onMouseDown
      if (this.coordinates.length < MIN_POINTS) return;
      this.drag = { anchor: { ...this._lastMouse }, base: this.coordinates };
      this._suppressMouseDown = true;
      return;
    }

    if (featureId === 'outline') {
      if (this.vertexDragIndex != null || !this._lastMouse) return; // dropping a vertex drag, handled by _onMouseDown
      const { lon, lat } = this._lastMouse;
      const i = nearestEdgeIndex([lon, lat], this.coordinates);
      this.coordinates.splice(i + 1, 0, [lon, lat]);
      this._redraw();
      this._suppressMouseDown = true;
      this.onChange?.({ type: 'Polygon', coordinates: [buildRing(this.coordinates)] });
      return;
    }

    if (!featureId.startsWith('vertex-')) return;
    const pointIndex = Number(featureId.slice('vertex-'.length));
    this._suppressMouseDown = true;
    if (this.vertexDragIndex != null) {
      // drop click landed back on a vertex marker
      this.vertexDragIndex = null;
      this._redraw();
      this.onChange?.({ type: 'Polygon', coordinates: [buildRing(this.coordinates)] });
      return;
    }
    this.vertexDragIndex = pointIndex; // arm
    this._redraw();
  }

  _onFeatureMouseEnter({ featureId, layerName }) {
    if (layerName !== LAYER_NAME || !featureId.startsWith('vertex-')) return;
    this.hoveredVertexIndex = Number(featureId.slice('vertex-'.length));
  }

  _onFeatureMouseLeave({ featureId, layerName }) {
    if (layerName !== LAYER_NAME || !featureId.startsWith('vertex-')) return;
    this.hoveredVertexIndex = null;
  }

  // Mirrors WME's own geometry editor: hover a vertex, press the configured key to delete it.
  _onDeleteShortcut() {
    if (this.hoveredVertexIndex == null) return;
    if (this.coordinates.length <= MIN_POINTS) {
      this.onChange?.(null, { error: `Un polígono necesita al menos ${MIN_POINTS} puntos.` });
      return;
    }
    this.coordinates.splice(this.hoveredVertexIndex, 1);
    this.hoveredVertexIndex = null;
    this._redraw();
    this.onChange?.({ type: 'Polygon', coordinates: [buildRing(this.coordinates)] });
  }

  // Both drags (whole shape and single vertex) are armed from
  // `_onFeatureClicked` (click on the fill / on a vertex marker); this
  // handler only drops them when the drop click misses every feature (arm
  // clicks and on-feature drop clicks are consumed there and flagged via
  // `_suppressMouseDown`). Rigid translation: dragging the whole shape moves
  // every vertex by the same delta, so the exact shape (square or
  // free-form) is preserved. See the click-vs-hold note up top.
  _onMouseDown() {
    if (this._suppressMouseDown) {
      this._suppressMouseDown = false;
      return;
    }
    if (this.vertexDragIndex != null) {
      this.vertexDragIndex = null;
      this._redraw();
      this.onChange?.({ type: 'Polygon', coordinates: [buildRing(this.coordinates)] });
      return;
    }
    if (this.drag) {
      this.drag = null;
      this.onChange?.({ type: 'Polygon', coordinates: [buildRing(this.coordinates)] });
    }
  }

  _onMouseMove({ lon, lat }) {
    this._lastMouse = { lon, lat };
    if (this.vertexDragIndex != null) {
      this.coordinates[this.vertexDragIndex] = [lon, lat];
      this._redraw();
      return;
    }
    if (!this.drag) return;
    const { anchor, base } = this.drag;
    const dLon = lon - anchor.lon;
    const dLat = lat - anchor.lat;
    this.coordinates = base.map(([x, y]) => [x + dLon, y + dLat]);
    this._redraw();
  }
}
