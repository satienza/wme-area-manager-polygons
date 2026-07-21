// ==UserScript==
// @name         WME Area Manager
// @namespace    https://greasyfork.org/en/scripts/freakyman-wme-area-manager-polygons
// @version      0.10.0
// @description  Draws area rectangles in WME based on the editor's level, with a link to the center and named rectangle saving.
// @author       freakyman
// @match        https://www.waze.com/*/editor*
// @match        https://www.waze.com/editor*
// @updateURL    https://raw.githubusercontent.com/satienza/wme-area-manager-polygons/main/dist/wme-area-manager.user.js
// @downloadURL  https://raw.githubusercontent.com/satienza/wme-area-manager-polygons/main/dist/wme-area-manager.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(() => {
  // src/sdk-safe.js
  function safeAddLayer(sdk, options) {
    try {
      sdk.Map.addLayer(options);
    } catch (error) {
      console.warn(`WME Area Manager: no se pudo crear la capa "${options.layerName}".`, error);
    }
  }
  function safeAddFeature(sdk, layerName, feature2) {
    try {
      sdk.Map.addFeatureToLayer({ layerName, feature: feature2 });
    } catch (error) {
      console.warn(`WME Area Manager: no se pudo a\xF1adir "${feature2.id}" a la capa "${layerName}".`, error);
    }
  }
  function safeRemoveFeature(sdk, layerName, featureId) {
    try {
      sdk.Map.removeFeatureFromLayer({ layerName, featureId });
    } catch {
    }
  }

  // src/map-layer.js
  var LAYER_NAME = "wme-area-manager-rectangle";
  var RectangleLayer = class {
    constructor(sdk) {
      this.sdk = sdk;
      safeAddLayer(sdk, {
        layerName: LAYER_NAME,
        styleRules: [
          { style: { fill: false, strokeColor: "#FF00FF", strokeWidth: 3 } },
          {
            predicate: (props) => props.role === "diagonal",
            style: { strokeColor: "#FF00FF", strokeWidth: 1, strokeDashstyle: "dash" }
          }
        ]
      });
      this.featureIds = [];
    }
    /**
     * @param {GeoJSON.Polygon} polygon
     * @param {GeoJSON.LineString[]} diagonals
     */
    draw(polygon, diagonals) {
      this.clear();
      const features = [
        { id: "outline", type: "Feature", geometry: polygon, properties: { role: "outline" } },
        ...diagonals.map((line, i) => ({
          id: `diagonal-${i}`,
          type: "Feature",
          geometry: line,
          properties: { role: "diagonal" }
        }))
      ];
      for (const feature2 of features) {
        safeAddFeature(this.sdk, LAYER_NAME, feature2);
        this.featureIds.push(feature2.id);
      }
    }
    clear() {
      for (const featureId of this.featureIds) {
        safeRemoveFeature(this.sdk, LAYER_NAME, featureId);
      }
      this.featureIds = [];
    }
  };

  // node_modules/@turf/helpers/dist/esm/index.js
  var earthRadius = 63710088e-1;
  var factors = {
    centimeters: earthRadius * 100,
    centimetres: earthRadius * 100,
    degrees: 360 / (2 * Math.PI),
    feet: earthRadius * 3.28084,
    inches: earthRadius * 39.37,
    kilometers: earthRadius / 1e3,
    kilometres: earthRadius / 1e3,
    meters: earthRadius,
    metres: earthRadius,
    miles: earthRadius / 1609.344,
    millimeters: earthRadius * 1e3,
    millimetres: earthRadius * 1e3,
    nauticalmiles: earthRadius / 1852,
    radians: 1,
    yards: earthRadius * 1.0936
  };
  function feature(geom, properties, options = {}) {
    const feat = { type: "Feature" };
    if (options.id === 0 || options.id) {
      feat.id = options.id;
    }
    if (options.bbox) {
      feat.bbox = options.bbox;
    }
    feat.properties = properties || {};
    feat.geometry = geom;
    return feat;
  }
  function point(coordinates, properties, options = {}) {
    if (!coordinates) {
      throw new Error("coordinates is required");
    }
    if (!Array.isArray(coordinates)) {
      throw new Error("coordinates must be an Array");
    }
    if (coordinates.length < 2) {
      throw new Error("coordinates must be at least 2 numbers long");
    }
    if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
      throw new Error("coordinates must contain numbers");
    }
    const geom = {
      type: "Point",
      coordinates
    };
    return feature(geom, properties, options);
  }
  function lengthToRadians(distance, units = "kilometers") {
    const factor = factors[units];
    if (!factor) {
      throw new Error(units + " units is invalid");
    }
    return distance / factor;
  }
  function radiansToDegrees(radians) {
    const normalisedRadians = radians % (2 * Math.PI);
    return normalisedRadians * 180 / Math.PI;
  }
  function degreesToRadians(degrees) {
    const normalisedDegrees = degrees % 360;
    return normalisedDegrees * Math.PI / 180;
  }
  function isNumber(num) {
    return !isNaN(num) && num !== null && !Array.isArray(num);
  }

  // node_modules/@turf/invariant/dist/esm/index.js
  function getCoord(coord) {
    if (!coord) {
      throw new Error("coord is required");
    }
    if (!Array.isArray(coord)) {
      if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
        return [...coord.geometry.coordinates];
      }
      if (coord.type === "Point") {
        return [...coord.coordinates];
      }
    }
    if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
      return [...coord];
    }
    throw new Error("coord must be GeoJSON Point or an Array of numbers");
  }

  // node_modules/@turf/destination/dist/esm/index.js
  function destination(origin, distance, bearing, options = {}) {
    const coordinates1 = getCoord(origin);
    const longitude1 = degreesToRadians(coordinates1[0]);
    const latitude1 = degreesToRadians(coordinates1[1]);
    const bearingRad = degreesToRadians(bearing);
    const radians = lengthToRadians(distance, options.units);
    const latitude2 = Math.asin(
      Math.sin(latitude1) * Math.cos(radians) + Math.cos(latitude1) * Math.sin(radians) * Math.cos(bearingRad)
    );
    const longitude2 = longitude1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(radians) * Math.cos(latitude1),
      Math.cos(radians) - Math.sin(latitude1) * Math.sin(latitude2)
    );
    const lng = radiansToDegrees(longitude2);
    const lat = radiansToDegrees(latitude2);
    if (coordinates1[2] !== void 0) {
      return point([lng, lat, coordinates1[2]], options.properties);
    }
    return point([lng, lat], options.properties);
  }
  var index_default = destination;

  // node_modules/@turf/meta/dist/esm/index.js
  function geomEach(geojson, callback) {
    var i, j, g, geometry, stopG, geometryMaybeCollection, isGeometryCollection, featureProperties, featureBBox, featureId, featureIndex = 0, isFeatureCollection = geojson.type === "FeatureCollection", isFeature = geojson.type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
    for (i = 0; i < stop; i++) {
      geometryMaybeCollection = isFeatureCollection ? (
        // @ts-expect-error: Known type conflict
        geojson.features[i].geometry
      ) : isFeature ? (
        // @ts-expect-error: Known type conflict
        geojson.geometry
      ) : geojson;
      featureProperties = isFeatureCollection ? (
        // @ts-expect-error: Known type conflict
        geojson.features[i].properties
      ) : isFeature ? (
        // @ts-expect-error: Known type conflict
        geojson.properties
      ) : {};
      featureBBox = isFeatureCollection ? (
        // @ts-expect-error: Known type conflict
        geojson.features[i].bbox
      ) : isFeature ? (
        // @ts-expect-error: Known type conflict
        geojson.bbox
      ) : void 0;
      featureId = isFeatureCollection ? (
        // @ts-expect-error: Known type conflict
        geojson.features[i].id
      ) : isFeature ? (
        // @ts-expect-error: Known type conflict
        geojson.id
      ) : void 0;
      isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
      stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
      for (g = 0; g < stopG; g++) {
        geometry = isGeometryCollection ? geometryMaybeCollection.geometries[g] : geometryMaybeCollection;
        if (geometry === null) {
          if (
            // @ts-expect-error: Known type conflict
            callback(
              // @ts-expect-error: Known type conflict
              null,
              featureIndex,
              featureProperties,
              featureBBox,
              featureId
            ) === false
          )
            return false;
          continue;
        }
        switch (geometry.type) {
          case "Point":
          case "LineString":
          case "MultiPoint":
          case "Polygon":
          case "MultiLineString":
          case "MultiPolygon": {
            if (
              // @ts-expect-error: Known type conflict
              callback(
                geometry,
                featureIndex,
                featureProperties,
                featureBBox,
                featureId
              ) === false
            )
              return false;
            break;
          }
          case "GeometryCollection": {
            for (j = 0; j < geometry.geometries.length; j++) {
              if (
                // @ts-expect-error: Known type conflict
                callback(
                  geometry.geometries[j],
                  featureIndex,
                  featureProperties,
                  featureBBox,
                  featureId
                ) === false
              )
                return false;
            }
            break;
          }
          default:
            throw new Error("Unknown Geometry Type");
        }
      }
      featureIndex++;
    }
  }
  function geomReduce(geojson, callback, initialValue) {
    var previousValue = initialValue;
    geomEach(
      geojson,
      function(currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
        if (featureIndex === 0 && initialValue === void 0)
          previousValue = currentGeometry;
        else
          previousValue = callback(
            // @ts-expect-error: Known type conflict
            previousValue,
            currentGeometry,
            featureIndex,
            featureProperties,
            featureBBox,
            featureId
          );
      }
    );
    return previousValue;
  }

  // node_modules/@turf/area/dist/esm/index.js
  function area(geojson) {
    return geomReduce(
      geojson,
      (value, geom) => {
        return value + calculateArea(geom);
      },
      0
    );
  }
  function calculateArea(geom) {
    let total = 0;
    let i;
    switch (geom.type) {
      case "Polygon":
        return polygonArea(geom.coordinates);
      case "MultiPolygon":
        for (i = 0; i < geom.coordinates.length; i++) {
          total += polygonArea(geom.coordinates[i]);
        }
        return total;
      case "Point":
      case "MultiPoint":
      case "LineString":
      case "MultiLineString":
        return 0;
    }
    return 0;
  }
  function polygonArea(coords) {
    let total = 0;
    if (coords && coords.length > 0) {
      total += Math.abs(ringArea(coords[0]));
      for (let i = 1; i < coords.length; i++) {
        total -= Math.abs(ringArea(coords[i]));
      }
    }
    return total;
  }
  var FACTOR = earthRadius * earthRadius / 2;
  var PI_OVER_180 = Math.PI / 180;
  function ringArea(coords) {
    const coordsLength = coords.length - 1;
    if (coordsLength <= 2) return 0;
    let total = 0;
    let i = 0;
    while (i < coordsLength) {
      const lower = coords[i];
      const middle = coords[i + 1 === coordsLength ? 0 : i + 1];
      const upper = coords[i + 2 >= coordsLength ? (i + 2) % coordsLength : i + 2];
      const lowerX = lower[0] * PI_OVER_180;
      const middleY = middle[1] * PI_OVER_180;
      const upperX = upper[0] * PI_OVER_180;
      total += (upperX - lowerX) * Math.sin(middleY);
      i++;
    }
    return total * FACTOR;
  }
  var index_default2 = area;

  // src/geometry.js
  function buildRectangleFromCenter(center, areaKm2, aspectRatio = 1) {
    const heightKm = Math.sqrt(areaKm2 / aspectRatio);
    const widthKm = aspectRatio * heightKm;
    const halfWidthKm = widthKm / 2;
    const halfHeightKm = heightKm / 2;
    const origin = point([center.lon, center.lat]);
    const [, northLat] = index_default(origin, halfHeightKm, 0, { units: "kilometers" }).geometry.coordinates;
    const [, southLat] = index_default(origin, halfHeightKm, 180, { units: "kilometers" }).geometry.coordinates;
    const [eastLon] = index_default(origin, halfWidthKm, 90, { units: "kilometers" }).geometry.coordinates;
    const [westLon] = index_default(origin, halfWidthKm, 270, { units: "kilometers" }).geometry.coordinates;
    const polygon = {
      type: "Polygon",
      coordinates: [[
        [westLon, southLat],
        [eastLon, southLat],
        [eastLon, northLat],
        [westLon, northLat],
        [westLon, southLat]
      ]]
    };
    return { polygon, bbox: [westLon, southLat, eastLon, northLat] };
  }
  function polygonAreaKm2(polygon) {
    return index_default2(polygon) / 1e6;
  }
  function polygonCenter(coordinates) {
    const lon = coordinates.reduce((sum, [x]) => sum + x, 0) / coordinates.length;
    const lat = coordinates.reduce((sum, [, y]) => sum + y, 0) / coordinates.length;
    return { lon, lat };
  }
  function buildDiagonals(polygon) {
    const [sw, se, ne, nw] = polygon.coordinates[0];
    return [
      { type: "LineString", coordinates: [sw, ne] },
      { type: "LineString", coordinates: [se, nw] }
    ];
  }
  function nearestEdgeIndex([x, y], coordinates) {
    let bestIndex = 0;
    let bestDistSq = Infinity;
    const n = coordinates.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = coordinates[i];
      const [x2, y2] = coordinates[(i + 1) % n];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      const t2 = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
      const px = x1 + t2 * dx;
      const py = y1 + t2 * dy;
      const distSq = (x - px) ** 2 + (y - py) ** 2;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = i;
      }
    }
    return bestIndex;
  }
  function geometryBbox(geometry) {
    const [ring] = geometry.coordinates;
    const lons = ring.map(([lon]) => lon);
    const lats = ring.map(([, lat]) => lat);
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  }
  function toGeoJSONFeature(entry) {
    const { geometry, ...properties } = entry;
    return { type: "Feature", geometry, properties };
  }
  function toWKT(polygon) {
    const rings = polygon.coordinates.map((ring) => `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(", ")})`).join(", ");
    return `POLYGON(${rings})`;
  }

  // src/polygon-layer.js
  var LAYER_NAME2 = "wme-area-manager-polygon";
  var MIN_POINTS = 3;
  var SHORTCUT_ID = "wme-area-manager-delete-vertex";
  var DEFAULT_DELETE_SHORTCUT_KEY = "k";
  function buildRing(coordinates) {
    return [...coordinates, coordinates[0]];
  }
  var PolygonLayer = class {
    /**
     * @param {string} [deleteShortcutKey] - persisted preference (src/storage.js);
     *   defaults to the key this script has always used.
     */
    constructor(sdk, deleteShortcutKey = DEFAULT_DELETE_SHORTCUT_KEY) {
      this.sdk = sdk;
      safeAddLayer(sdk, {
        layerName: LAYER_NAME2,
        styleRules: [
          {
            predicate: (props) => props.role === "fill" && props.valid,
            style: { fill: true, fillColor: "#2ECC40", fillOpacity: 0.15 }
          },
          {
            predicate: (props) => props.role === "fill" && !props.valid,
            style: { fill: true, fillColor: "#FF4136", fillOpacity: 0.15 }
          },
          {
            predicate: (props) => props.role === "outline" && props.valid,
            style: { fill: false, strokeColor: "#2ECC40", strokeWidth: 3 }
          },
          {
            predicate: (props) => props.role === "outline" && !props.valid,
            style: { fill: false, strokeColor: "#FF4136", strokeWidth: 3 }
          },
          {
            predicate: (props) => props.role === "vertex" && !props.dragging,
            style: { fillColor: "#FF00FF", fillOpacity: 1, pointRadius: 8 }
          },
          {
            predicate: (props) => props.role === "vertex" && props.dragging,
            style: { fillColor: "#FFDC00", fillOpacity: 1, pointRadius: 8 }
          }
        ]
      });
      this.sdk.Events.trackLayerEvents({ layerName: LAYER_NAME2 });
      this.sdk.Events.on({ eventName: "wme-layer-feature-clicked", eventHandler: this._onFeatureClicked.bind(this) });
      this.sdk.Events.on({ eventName: "wme-layer-feature-mouse-enter", eventHandler: this._onFeatureMouseEnter.bind(this) });
      this.sdk.Events.on({ eventName: "wme-layer-feature-mouse-leave", eventHandler: this._onFeatureMouseLeave.bind(this) });
      this.sdk.Events.on({ eventName: "wme-map-mouse-down", eventHandler: this._onMouseDown.bind(this) });
      this.sdk.Events.on({ eventName: "wme-map-mouse-move", eventHandler: this._onMouseMove.bind(this) });
      this.shortcutKey = deleteShortcutKey;
      this._registerDeleteShortcut();
      this.featureIds = [];
      this.coordinates = [];
      this.onChange = null;
      this.drag = null;
      this.vertexDragIndex = null;
      this.hoveredVertexIndex = null;
      this._lastMouse = null;
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
          description: "WME Area Manager: borrar el v\xE9rtice bajo el cursor",
          callback: this._onDeleteShortcut.bind(this)
        });
      } catch (error) {
        console.warn("WME Area Manager: no se pudo registrar el atajo para borrar v\xE9rtices.", error);
      }
    }
    /** @param {string} key - single key, persisted by the caller (src/storage.js). */
    setDeleteShortcutKey(key) {
      try {
        this.sdk.Shortcuts.deleteShortcut({ shortcutId: SHORTCUT_ID });
      } catch (error) {
        console.warn("WME Area Manager: no se pudo desregistrar el atajo anterior.", error);
      }
      this.shortcutKey = key;
      this._registerDeleteShortcut();
    }
    setValid(valid) {
      for (const role of ["fill", "outline"]) {
        safeRemoveFeature(this.sdk, LAYER_NAME2, role);
        safeAddFeature(this.sdk, LAYER_NAME2, {
          id: role,
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [buildRing(this.coordinates)] },
          properties: { role, valid }
        });
      }
    }
    clear() {
      for (const featureId of this.featureIds) {
        safeRemoveFeature(this.sdk, LAYER_NAME2, featureId);
      }
      this.featureIds = [];
    }
    _redraw() {
      this.clear();
      const features = [
        {
          id: "fill",
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [buildRing(this.coordinates)] },
          properties: { role: "fill", valid: true }
        },
        {
          id: "outline",
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [buildRing(this.coordinates)] },
          properties: { role: "outline", valid: true }
        },
        ...this.coordinates.map((coordinate, i) => ({
          id: `vertex-${i}`,
          type: "Feature",
          geometry: { type: "Point", coordinates: coordinate },
          properties: { role: "vertex", pointIndex: i, dragging: i === this.vertexDragIndex }
        }))
      ];
      for (const feature2 of features) {
        safeAddFeature(this.sdk, LAYER_NAME2, feature2);
        this.featureIds.push(feature2.id);
      }
    }
    _onFeatureClicked({ featureId, layerName }) {
      if (layerName !== LAYER_NAME2) return;
      if (this.drag) return;
      if (featureId === "fill") {
        if (this.vertexDragIndex != null || !this._lastMouse) return;
        if (this.coordinates.length < MIN_POINTS) return;
        this.drag = { anchor: { ...this._lastMouse }, base: this.coordinates };
        this._suppressMouseDown = true;
        return;
      }
      if (featureId === "outline") {
        if (this.vertexDragIndex != null || !this._lastMouse) return;
        const { lon, lat } = this._lastMouse;
        const i = nearestEdgeIndex([lon, lat], this.coordinates);
        this.coordinates.splice(i + 1, 0, [lon, lat]);
        this._redraw();
        this._suppressMouseDown = true;
        this.onChange?.({ type: "Polygon", coordinates: [buildRing(this.coordinates)] });
        return;
      }
      if (!featureId.startsWith("vertex-")) return;
      const pointIndex = Number(featureId.slice("vertex-".length));
      this._suppressMouseDown = true;
      if (this.vertexDragIndex != null) {
        this.vertexDragIndex = null;
        this._redraw();
        this.onChange?.({ type: "Polygon", coordinates: [buildRing(this.coordinates)] });
        return;
      }
      this.vertexDragIndex = pointIndex;
      this._redraw();
    }
    _onFeatureMouseEnter({ featureId, layerName }) {
      if (layerName !== LAYER_NAME2 || !featureId.startsWith("vertex-")) return;
      this.hoveredVertexIndex = Number(featureId.slice("vertex-".length));
    }
    _onFeatureMouseLeave({ featureId, layerName }) {
      if (layerName !== LAYER_NAME2 || !featureId.startsWith("vertex-")) return;
      this.hoveredVertexIndex = null;
    }
    // Mirrors WME's own geometry editor: hover a vertex, press the configured key to delete it.
    _onDeleteShortcut() {
      if (this.hoveredVertexIndex == null) return;
      if (this.coordinates.length <= MIN_POINTS) {
        this.onChange?.(null, { error: `Un pol\xEDgono necesita al menos ${MIN_POINTS} puntos.` });
        return;
      }
      this.coordinates.splice(this.hoveredVertexIndex, 1);
      this.hoveredVertexIndex = null;
      this._redraw();
      this.onChange?.({ type: "Polygon", coordinates: [buildRing(this.coordinates)] });
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
        this.onChange?.({ type: "Polygon", coordinates: [buildRing(this.coordinates)] });
        return;
      }
      if (this.drag) {
        this.drag = null;
        this.onChange?.({ type: "Polygon", coordinates: [buildRing(this.coordinates)] });
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
  };

  // src/saved-shape-layer.js
  var LAYER_NAME3 = "wme-area-manager-saved-shape";
  var SavedShapeLayer = class {
    constructor(sdk) {
      this.sdk = sdk;
      safeAddLayer(sdk, {
        layerName: LAYER_NAME3,
        styleRules: [{ style: { fill: false, strokeColor: "#0074D9", strokeWidth: 3 } }]
      });
      this.featureIds = [];
    }
    /** @param {GeoJSON.Polygon} geometry */
    draw(geometry) {
      this.clear();
      const feature2 = { id: "outline", type: "Feature", geometry, properties: {} };
      safeAddFeature(this.sdk, LAYER_NAME3, feature2);
      this.featureIds.push(feature2.id);
    }
    clear() {
      for (const featureId of this.featureIds) {
        safeRemoveFeature(this.sdk, LAYER_NAME3, featureId);
      }
      this.featureIds = [];
    }
  };

  // src/config.js
  var LEVEL_RULES = [
    { levels: [1, 2], zoom: 15, areaKm2: 7.59 },
    { levels: [3], zoom: 14, areaKm2: 30.37 },
    { levels: [4, 5], zoom: 13, areaKm2: 121.5 }
  ];
  function getConfigForRank(rank) {
    const level = rank + 1;
    if (level < 1) {
      throw new Error(`Rank de usuario inv\xE1lido: ${rank}`);
    }
    const rule = LEVEL_RULES.find((r) => r.levels.includes(level)) ?? LEVEL_RULES[LEVEL_RULES.length - 1];
    return { level, zoom: rule.zoom, areaKm2: rule.areaKm2 };
  }

  // src/link.js
  function buildEditorLink({ lat, lon, zoom, env = "row" }) {
    const latStr = lat.toFixed(5);
    const lonStr = lon.toFixed(5);
    return `https://waze.com/editor?env=${env}&lat=${latStr}&lon=${lonStr}&marker=true&zoomLevel=${zoom}`;
  }

  // src/storage.js
  var STORAGE_KEY = "wme-area-manager:rectangles";
  var SHORTCUT_KEY_STORAGE_KEY = "wme-area-manager:delete-shortcut-key";
  function loadRectangles() {
    const raw = GM_getValue(STORAGE_KEY, []);
    if (!Array.isArray(raw)) {
      console.warn("WME Area Manager: guardado corrupto en GM_getValue (no es una lista); se ignora.", raw);
      return [];
    }
    return raw.filter((entry) => {
      const ok = entry && typeof entry === "object" && entry.id && entry.geometry;
      if (!ok) console.warn("WME Area Manager: entrada guardada corrupta; se descarta.", entry);
      return ok;
    });
  }
  function loadDeleteShortcutKey() {
    return GM_getValue(SHORTCUT_KEY_STORAGE_KEY, DEFAULT_DELETE_SHORTCUT_KEY);
  }
  function saveDeleteShortcutKey(key) {
    GM_setValue(SHORTCUT_KEY_STORAGE_KEY, key);
  }
  function persist(rectangles) {
    GM_setValue(STORAGE_KEY, rectangles);
  }
  function saveRectangle(rectangle) {
    const rectangles = loadRectangles();
    const id = rectangle.id ?? crypto.randomUUID();
    const index = rectangles.findIndex((r) => r.id === id);
    const entry = {
      ...rectangle,
      id,
      fechaCreacion: rectangle.fechaCreacion ?? (/* @__PURE__ */ new Date()).toISOString()
    };
    if (index >= 0) {
      rectangles[index] = entry;
    } else {
      rectangles.push(entry);
    }
    persist(rectangles);
    return entry;
  }
  function renameRectangle(id, nombre) {
    const rectangles = loadRectangles();
    const entry = rectangles.find((r) => r.id === id);
    if (!entry) throw new Error(`Rect\xE1ngulo ${id} no encontrado`);
    entry.nombre = nombre;
    persist(rectangles);
    return entry;
  }
  function deleteRectangle(id) {
    const rectangles = loadRectangles().filter((r) => r.id !== id);
    persist(rectangles);
  }

  // src/i18n.js
  var DICTIONARIES = {
    es: {
      tabLabel: "Area Manager",
      shapeRectangle: "Rect\xE1ngulo",
      shapePolygon: "Pol\xEDgono",
      namePlaceholder: "Nombre",
      save: "Guardar",
      clearDrawing: "Limpiar dibujo",
      nameRequired: "El nombre es obligatorio para guardar.",
      nothingToSave: "No hay ninguna figura para guardar.",
      saved: (nombre) => `Guardado "${nombre}".`,
      noSavedShapes: "No hay figuras guardadas.",
      sectionCurrentShape: "Figura actual",
      sectionSaved: "Guardadas",
      load: "Cargar",
      edit: "Editar",
      exportGeoJSON: "GeoJSON",
      exportWKT: "WKT",
      copyLink: "Copiar enlace",
      rename: "Renombrar",
      delete: "Eliminar",
      linkCopied: "Enlace copiado.",
      linkCopyFailed: "No se pudo copiar autom\xE1ticamente; usa el campo de enlace.",
      renamePrompt: "Nuevo nombre:",
      placeRectangle: "Colocar rect\xE1ngulo",
      placePolygon: "Colocar pol\xEDgono",
      areaWithinLimit: (areaKm2, level, maxAreaKm2) => `\xC1rea: ${areaKm2} km\xB2 \u2014 dentro del l\xEDmite del nivel ${level} (m\xE1x. ${maxAreaKm2} km\xB2)`,
      areaExceedsLimit: (areaKm2, level, maxAreaKm2) => `\xC1rea: ${areaKm2} km\xB2 \u2014 supera el l\xEDmite del nivel ${level} (m\xE1x. ${maxAreaKm2} km\xB2)`,
      drawingCancelled: "Dibujo cancelado.",
      placementFailed: (message) => `No se pudo colocar la figura: ${message}. Prueba a acercar el zoom.`,
      polygonEditHelp: (key) => `Edici\xF3n del pol\xEDgono: clic en el borde a\xF1ade un punto \xB7 clic en el interior arrastra la figura \xB7 clic en un v\xE9rtice lo arrastra \xB7 pasar el rat\xF3n por un v\xE9rtice y pulsar "${key}" lo borra.`,
      deleteShortcutLabel: "Tecla para borrar v\xE9rtice:",
      deleteShortcutSaved: (key) => `Atajo de borrado actualizado a "${key}".`,
      invalidShortcutKey: "Introduce una \xFAnica tecla."
    },
    en: {
      tabLabel: "Area Manager",
      shapeRectangle: "Rectangle",
      shapePolygon: "Polygon",
      namePlaceholder: "Name",
      save: "Save",
      clearDrawing: "Clear drawing",
      nameRequired: "A name is required to save.",
      nothingToSave: "There is no shape to save.",
      saved: (nombre) => `Saved "${nombre}".`,
      noSavedShapes: "No saved shapes.",
      sectionCurrentShape: "Current shape",
      sectionSaved: "Saved",
      load: "Load",
      edit: "Edit",
      exportGeoJSON: "GeoJSON",
      exportWKT: "WKT",
      copyLink: "Copy link",
      rename: "Rename",
      delete: "Delete",
      linkCopied: "Link copied.",
      linkCopyFailed: "Could not copy automatically; use the link field.",
      renamePrompt: "New name:",
      placeRectangle: "Place rectangle",
      placePolygon: "Place polygon",
      areaWithinLimit: (areaKm2, level, maxAreaKm2) => `Area: ${areaKm2} km\xB2 \u2014 within the level ${level} limit (max ${maxAreaKm2} km\xB2)`,
      areaExceedsLimit: (areaKm2, level, maxAreaKm2) => `Area: ${areaKm2} km\xB2 \u2014 exceeds the level ${level} limit (max ${maxAreaKm2} km\xB2)`,
      drawingCancelled: "Drawing cancelled.",
      placementFailed: (message) => `Could not place the shape: ${message}. Try zooming in.`,
      polygonEditHelp: (key) => `Polygon editing: click the edge to add a point \xB7 click the interior to drag the shape \xB7 click a vertex to drag it \xB7 hover a vertex and press "${key}" to delete it.`,
      deleteShortcutLabel: "Delete-vertex key:",
      deleteShortcutSaved: (key) => `Delete shortcut updated to "${key}".`,
      invalidShortcutKey: "Enter a single key."
    }
  };
  var DEFAULT_LANG = "es";
  function resolveLang(rawLocale) {
    const lang = String(rawLocale).split("-")[0];
    return DICTIONARIES[lang] ? lang : DEFAULT_LANG;
  }
  var activeLang = DEFAULT_LANG;
  function initI18n(sdk) {
    try {
      const { localeCode } = sdk.Settings.getLocale();
      activeLang = resolveLang(localeCode);
    } catch (error) {
      console.warn("WME Area Manager: no se pudo detectar el idioma de WME; se usa espa\xF1ol por defecto.", error);
      activeLang = DEFAULT_LANG;
    }
  }
  function t(key, ...args) {
    const entry = DICTIONARIES[activeLang]?.[key] ?? DICTIONARIES[DEFAULT_LANG][key];
    return typeof entry === "function" ? entry(...args) : entry;
  }

  // src/sidebar.js
  var ASPECT_RATIOS = [
    { label: "1:1", value: 1 },
    { label: "3:2", value: 3 / 2 },
    { label: "4:3", value: 4 / 3 }
  ];
  function detectEnv(sdk) {
    try {
      const country = sdk.DataModel.Countries.getTopCountry();
      if (country?.regionCode) return country.regionCode;
    } catch (error) {
      console.warn('WME Area Manager: no se pudo detectar el entorno (env); se usa "row" por defecto.', error);
    }
    return "row";
  }
  function buildIcon(name) {
    const icon = document.createElement("i");
    icon.className = `fa fa-${name}`;
    return icon;
  }
  function formatTimestamp(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }
  function initSidebar({ sdk, layer, polygonLayer, savedShapeLayer }) {
    const DEFAULT_ENV = detectEnv(sdk);
    const SHAPES = [
      { label: t("shapeRectangle"), value: "rectangle" },
      { label: t("shapePolygon"), value: "polygon" }
    ];
    sdk.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
      tabLabel.innerText = t("tabLabel");
      const style = document.createElement("style");
      style.textContent = `
      .wme-am-section { border: 1px solid #ccc; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
      .wme-am-section-header { font-weight: bold; margin-bottom: 6px; }
      .wme-am-section > *:not(:last-child) { margin-bottom: 6px; }
      .wme-am-entry-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
      .wme-am-entry-table td { border: 1px solid #ccc; padding: 2px 6px; text-align: left; }
      .wme-am-entry-table tr:first-child td { font-weight: bold; }
      .wme-am-actions-row { display: flex; gap: 4px; margin-bottom: 4px; }
    `;
      tabPane.appendChild(style);
      const currentShapeSection = document.createElement("div");
      currentShapeSection.className = "wme-am-section";
      const currentShapeHeader = document.createElement("div");
      currentShapeHeader.className = "wme-am-section-header";
      currentShapeHeader.innerText = t("sectionCurrentShape");
      currentShapeSection.appendChild(currentShapeHeader);
      tabPane.appendChild(currentShapeSection);
      const savedSection = document.createElement("div");
      savedSection.className = "wme-am-section";
      const savedHeader = document.createElement("div");
      savedHeader.className = "wme-am-section-header";
      savedHeader.innerText = t("sectionSaved");
      savedSection.appendChild(savedHeader);
      tabPane.appendChild(savedSection);
      const shapeSelect = document.createElement("select");
      for (const { label, value } of SHAPES) {
        const option = document.createElement("option");
        option.value = value;
        option.innerText = label;
        shapeSelect.appendChild(option);
      }
      currentShapeSection.appendChild(shapeSelect);
      const aspectSelect = document.createElement("select");
      for (const { label, value } of ASPECT_RATIOS) {
        const option = document.createElement("option");
        option.value = value;
        option.innerText = label;
        aspectSelect.appendChild(option);
      }
      currentShapeSection.appendChild(aspectSelect);
      const polygonHelpDiv = document.createElement("div");
      currentShapeSection.appendChild(polygonHelpDiv);
      const shortcutLabel = document.createElement("label");
      shortcutLabel.innerText = t("deleteShortcutLabel");
      currentShapeSection.appendChild(shortcutLabel);
      const shortcutInput = document.createElement("input");
      shortcutInput.type = "text";
      shortcutInput.maxLength = 1;
      shortcutInput.style.width = "2em";
      shortcutInput.value = loadDeleteShortcutKey();
      shortcutLabel.appendChild(shortcutInput);
      function refreshPolygonHelp() {
        polygonHelpDiv.innerText = t("polygonEditHelp", shortcutInput.value);
      }
      shortcutInput.addEventListener("change", () => {
        const key = shortcutInput.value.trim();
        if (key.length !== 1) {
          statusDiv.innerText = t("invalidShortcutKey");
          shortcutInput.value = loadDeleteShortcutKey();
          return;
        }
        saveDeleteShortcutKey(key);
        polygonLayer.setDeleteShortcutKey(key);
        statusDiv.innerText = t("deleteShortcutSaved", key);
        refreshPolygonHelp();
      });
      const placeButton = document.createElement("button");
      currentShapeSection.appendChild(placeButton);
      const statusDiv = document.createElement("div");
      currentShapeSection.appendChild(statusDiv);
      const linkInput = document.createElement("input");
      linkInput.type = "text";
      linkInput.readOnly = true;
      linkInput.style.width = "100%";
      currentShapeSection.appendChild(linkInput);
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = t("namePlaceholder");
      nameInput.style.width = "100%";
      currentShapeSection.appendChild(nameInput);
      const saveButton = document.createElement("button");
      saveButton.appendChild(buildIcon("save"));
      saveButton.appendChild(document.createTextNode(" " + t("save")));
      currentShapeSection.appendChild(saveButton);
      const clearButton = document.createElement("button");
      clearButton.innerText = t("clearDrawing");
      currentShapeSection.appendChild(clearButton);
      const exportOutput = document.createElement("textarea");
      exportOutput.readOnly = true;
      exportOutput.rows = 3;
      exportOutput.style.width = "100%";
      currentShapeSection.appendChild(exportOutput);
      const listContainer = document.createElement("div");
      savedSection.appendChild(listContainer);
      let currentEntry = null;
      let activeLayer = null;
      let shownEntryId = null;
      function updateCurrentEntry(entry) {
        currentEntry = { ...currentEntry, ...entry, env: DEFAULT_ENV };
      }
      function autofillName() {
        nameInput.value = `Polygon ${formatTimestamp(/* @__PURE__ */ new Date())}`;
      }
      saveButton.addEventListener("click", () => {
        const nombre = nameInput.value.trim();
        if (!nombre) {
          statusDiv.innerText = t("nameRequired");
          return;
        }
        if (!currentEntry) {
          statusDiv.innerText = t("nothingToSave");
          return;
        }
        saveRectangle({ ...currentEntry, nombre });
        statusDiv.innerText = t("saved", nombre);
        renderList();
      });
      clearButton.addEventListener("click", () => {
        activeLayer?.clear();
        activeLayer = null;
      });
      function renderList() {
        listContainer.innerHTML = "";
        const rectangles = loadRectangles();
        if (rectangles.length === 0) {
          listContainer.innerText = t("noSavedShapes");
          return;
        }
        for (const entry of rectangles) {
          listContainer.appendChild(buildEntryRow(entry));
        }
      }
      function buildEntryRow(entry) {
        const row = document.createElement("div");
        row.style.borderTop = "1px solid #ccc";
        row.style.padding = "4px 0";
        const table = document.createElement("table");
        table.className = "wme-am-entry-table";
        const nameRow = document.createElement("tr");
        const nameCell = document.createElement("td");
        nameCell.colSpan = 3;
        nameCell.innerText = entry.nombre;
        nameRow.appendChild(nameCell);
        table.appendChild(nameRow);
        const detailRow = document.createElement("tr");
        const fecha = new Date(entry.fechaCreacion);
        for (const text of [`N${entry.nivel}`, fecha.toLocaleDateString("es-ES"), fecha.toLocaleTimeString("es-ES")]) {
          const cell = document.createElement("td");
          cell.innerText = text;
          detailRow.appendChild(cell);
        }
        table.appendChild(detailRow);
        row.appendChild(table);
        const actionsRow1 = document.createElement("div");
        actionsRow1.className = "wme-am-actions-row";
        row.appendChild(actionsRow1);
        const actionsRow2 = document.createElement("div");
        actionsRow2.className = "wme-am-actions-row";
        row.appendChild(actionsRow2);
        function addAction(container, label, onClick, iconName) {
          const button = document.createElement("button");
          if (iconName) button.appendChild(buildIcon(iconName));
          button.appendChild(document.createTextNode(iconName ? " " + label : label));
          button.addEventListener("click", onClick);
          container.appendChild(button);
        }
        addAction(actionsRow1, t("load"), () => {
          savedShapeLayer.draw(entry.geometry);
          sdk.Map.zoomToExtent({ bbox: geometryBbox(entry.geometry) });
          activeLayer = savedShapeLayer;
          shownEntryId = entry.id;
        });
        addAction(actionsRow1, t("edit"), () => {
          currentEntry = { ...entry, env: DEFAULT_ENV };
          nameInput.value = entry.nombre;
          polygonLayer.draw(entry.geometry, { onChange: updatePolygonStatus });
          updatePolygonStatus(entry.geometry);
          activeLayer = polygonLayer;
        }, "edit");
        addAction(actionsRow1, t("rename"), () => {
          const nombre = prompt(t("renamePrompt"), entry.nombre);
          if (!nombre) return;
          renameRectangle(entry.id, nombre);
          renderList();
        }, "tag");
        addAction(actionsRow1, t("delete"), () => {
          deleteRectangle(entry.id);
          if (currentEntry?.id === entry.id) {
            polygonLayer.clear();
            currentEntry = null;
          }
          if (shownEntryId === entry.id) {
            savedShapeLayer.clear();
            shownEntryId = null;
          }
          renderList();
        }, "trash");
        addAction(actionsRow2, t("copyLink"), () => {
          const enlace = buildEditorLink({ lat: entry.lat, lon: entry.lon, zoom: entry.zoom, env: entry.env });
          navigator.clipboard.writeText(enlace).then(
            () => {
              statusDiv.innerText = t("linkCopied");
            },
            () => {
              linkInput.value = enlace;
              statusDiv.innerText = t("linkCopyFailed");
            }
          );
        }, "link");
        addAction(actionsRow2, t("exportGeoJSON"), () => {
          exportOutput.value = JSON.stringify(toGeoJSONFeature(entry));
        });
        addAction(actionsRow2, t("exportWKT"), () => {
          exportOutput.value = toWKT(entry.geometry);
        });
        return row;
      }
      renderList();
      function updateShapeUI() {
        const isRectangle = shapeSelect.value === "rectangle";
        aspectSelect.style.display = isRectangle ? "" : "none";
        polygonHelpDiv.style.display = isRectangle ? "none" : "";
        shortcutLabel.style.display = isRectangle ? "none" : "";
        placeButton.innerText = isRectangle ? t("placeRectangle") : t("placePolygon");
      }
      shapeSelect.addEventListener("change", updateShapeUI);
      refreshPolygonHelp();
      updateShapeUI();
      function updatePolygonStatus(polygon, { error } = {}) {
        if (error) {
          statusDiv.innerText = error;
          return;
        }
        const userInfo = sdk.State.getUserInfo();
        if (!userInfo || !polygon) return;
        const { level, zoom, areaKm2: maxAreaKm2 } = getConfigForRank(userInfo.rank);
        const areaKm2 = polygonAreaKm2(polygon);
        const valid = areaKm2 <= maxAreaKm2;
        polygonLayer.setValid(valid);
        statusDiv.innerText = valid ? t("areaWithinLimit", areaKm2.toFixed(2), level, maxAreaKm2) : t("areaExceedsLimit", areaKm2.toFixed(2), level, maxAreaKm2);
        const { lon, lat } = polygonCenter(polygon.coordinates[0].slice(0, -1));
        linkInput.value = buildEditorLink({ lat, lon, zoom });
        updateCurrentEntry({ geometry: polygon, lat, lon, nivel: level, zoom, area_km2: areaKm2 });
      }
      async function placeRectangle() {
        const userInfo = sdk.State.getUserInfo();
        if (!userInfo) return;
        const { level, zoom, areaKm2 } = getConfigForRank(userInfo.rank);
        const { coordinates: [lon, lat] } = await sdk.Map.drawPoint();
        const { polygon, bbox } = buildRectangleFromCenter({ lon, lat }, areaKm2, Number(aspectSelect.value));
        currentEntry = null;
        layer.draw(polygon, buildDiagonals(polygon));
        activeLayer = layer;
        sdk.Map.zoomToExtent({ bbox });
        linkInput.value = buildEditorLink({ lat, lon, zoom });
        updateCurrentEntry({ geometry: polygon, lat, lon, nivel: level, zoom, area_km2: polygonAreaKm2(polygon) });
        autofillName();
      }
      async function placePolygon() {
        const polygon = await sdk.Map.drawPolygon();
        if (!polygon) {
          statusDiv.innerText = t("drawingCancelled");
          return;
        }
        currentEntry = null;
        polygonLayer.draw(polygon, { onChange: updatePolygonStatus });
        activeLayer = polygonLayer;
        updatePolygonStatus(polygon);
        autofillName();
      }
      placeButton.addEventListener("click", async () => {
        statusDiv.innerText = "";
        try {
          if (shapeSelect.value === "rectangle") {
            await placeRectangle();
          } else {
            await placePolygon();
          }
        } catch (error) {
          statusDiv.innerText = t("placementFailed", error.message);
        }
      });
    }).catch((error) => {
      console.error("WME Area Manager: no se pudo registrar la pesta\xF1a del panel.", error);
    });
  }

  // src/index.js
  function initScript() {
    const sdk = unsafeWindow.getWmeSdk({
      scriptId: "wme-area-manager",
      scriptName: "WME Area Manager"
    });
    initI18n(sdk);
    sdk.Events.once({ eventName: "wme-ready" }).then(() => {
      const layer = new RectangleLayer(sdk);
      const polygonLayer = new PolygonLayer(sdk, loadDeleteShortcutKey());
      const savedShapeLayer = new SavedShapeLayer(sdk);
      initSidebar({ sdk, layer, polygonLayer, savedShapeLayer });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => unsafeWindow.SDK_INITIALIZED.then(initScript));
  } else {
    unsafeWindow.SDK_INITIALIZED.then(initScript);
  }
})();
