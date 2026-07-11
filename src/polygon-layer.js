// Custom SDK layer to draw a free-form polygon and let the user delete
// loose vertices, without touching WME's DataModel (same approach as
// RectangleLayer, see map-layer.js).
//
// Vertex deletion uses a left click on the vertex marker
// (`wme-layer-feature-clicked`, via `Events.trackLayerEvents`): the SDK
// doesn't expose which mouse button was pressed (`SdkMouseEvent` has no
// `button` field) nor a right-click event on features, so a real
// right-click would require hooking the DOM's `contextmenu` outside the
// public SDK. See requisitos_wme_area_manager.md, section 2 (point 5.1).

const LAYER_NAME = 'wme-area-manager-polygon';
const MIN_POINTS = 3;

function buildRing(coordinates) {
  return [...coordinates, coordinates[0]];
}

export class PolygonLayer {
  constructor(sdk) {
    this.sdk = sdk;
    this.sdk.Map.addLayer({
      layerName: LAYER_NAME,
      styleRules: [
        {
          predicate: (props) => props.role === 'outline' && props.valid,
          style: { fill: false, strokeColor: '#2ECC40', strokeWidth: 3 },
        },
        {
          predicate: (props) => props.role === 'outline' && !props.valid,
          style: { fill: false, strokeColor: '#FF4136', strokeWidth: 3 },
        },
        {
          predicate: (props) => props.role === 'vertex',
          style: { fillColor: '#FF00FF', fillOpacity: 1, pointRadius: 5 },
        },
      ],
    });
    this.sdk.Events.trackLayerEvents({ layerName: LAYER_NAME });
    this.sdk.Events.on({ eventName: 'wme-layer-feature-clicked', eventHandler: this._onFeatureClicked.bind(this) });
    this.featureIds = [];
    this.coordinates = [];
    this.onChange = null;
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

  setValid(valid) {
    this.sdk.Map.removeFeatureFromLayer({ layerName: LAYER_NAME, featureId: 'outline' });
    this.sdk.Map.addFeatureToLayer({
      layerName: LAYER_NAME,
      feature: {
        id: 'outline',
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [buildRing(this.coordinates)] },
        properties: { role: 'outline', valid },
      },
    });
  }

  clear() {
    for (const featureId of this.featureIds) {
      this.sdk.Map.removeFeatureFromLayer({ layerName: LAYER_NAME, featureId });
    }
    this.featureIds = [];
  }

  _redraw() {
    this.clear();
    const features = [
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
        properties: { role: 'vertex', pointIndex: i },
      })),
    ];
    for (const feature of features) {
      this.sdk.Map.addFeatureToLayer({ layerName: LAYER_NAME, feature });
      this.featureIds.push(feature.id);
    }
  }

  _onFeatureClicked({ featureId, layerName }) {
    if (layerName !== LAYER_NAME || !featureId.startsWith('vertex-')) return;
    if (this.coordinates.length <= MIN_POINTS) {
      this.onChange?.(null, { error: `Un polígono necesita al menos ${MIN_POINTS} puntos.` });
      return;
    }
    const pointIndex = Number(featureId.slice('vertex-'.length));
    this.coordinates.splice(pointIndex, 1);
    this._redraw();
    this.onChange?.({ type: 'Polygon', coordinates: [buildRing(this.coordinates)] });
  }
}
