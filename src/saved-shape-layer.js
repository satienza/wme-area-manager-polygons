// Minimal read-only layer for reviewing a saved shape: a single outline
// style, no vertex markers, no validity coloring, no click handlers (that
// editing behaviour belongs to PolygonLayer, see polygon-layer.js).
// See PLAN.md, Fase 4.

const LAYER_NAME = 'wme-area-manager-saved-shape';

export class SavedShapeLayer {
  constructor(sdk) {
    this.sdk = sdk;
    this.sdk.Map.addLayer({
      layerName: LAYER_NAME,
      styleRules: [{ style: { fill: false, strokeColor: '#0074D9', strokeWidth: 3 } }],
    });
    this.featureIds = [];
  }

  /** @param {GeoJSON.Polygon} geometry */
  draw(geometry) {
    this.clear();
    const feature = { id: 'outline', type: 'Feature', geometry, properties: {} };
    this.sdk.Map.addFeatureToLayer({ layerName: LAYER_NAME, feature });
    this.featureIds.push(feature.id);
  }

  clear() {
    for (const featureId of this.featureIds) {
      this.sdk.Map.removeFeatureFromLayer({ layerName: LAYER_NAME, featureId });
    }
    this.featureIds = [];
  }
}
