// Custom SDK layer to draw and drag the rectangle without touching WME's
// DataModel (using a real Venue was discarded, see requirements section 3.1).

const LAYER_NAME = 'wme-area-manager-rectangle';

export class RectangleLayer {
  constructor(sdk) {
    this.sdk = sdk;
    this.sdk.Map.addLayer({
      layerName: LAYER_NAME,
      styleRules: [
        { style: { fill: false, strokeColor: '#FF00FF', strokeWidth: 3 } },
        {
          predicate: (props) => props.role === 'diagonal',
          style: { strokeColor: '#FF00FF', strokeWidth: 1, strokeDashstyle: 'dash' },
        },
      ],
    });
    this.featureIds = [];
    // TODO (Phase 4): register wme-map-mouse-down/move/up for manual dragging,
    // recalculating the center and redrawing on every move.
  }

  /**
   * @param {GeoJSON.Polygon} polygon
   * @param {GeoJSON.LineString[]} diagonals
   */
  draw(polygon, diagonals) {
    this.clear();
    const features = [
      { id: 'outline', type: 'Feature', geometry: polygon, properties: { role: 'outline' } },
      ...diagonals.map((line, i) => ({
        id: `diagonal-${i}`,
        type: 'Feature',
        geometry: line,
        properties: { role: 'diagonal' },
      })),
    ];
    for (const feature of features) {
      this.sdk.Map.addFeatureToLayer({ layerName: LAYER_NAME, feature });
      this.featureIds.push(feature.id);
    }
  }

  clear() {
    for (const featureId of this.featureIds) {
      this.sdk.Map.removeFeatureFromLayer({ layerName: LAYER_NAME, featureId });
    }
    this.featureIds = [];
  }
}
