// Custom SDK layer to draw the rectangle without touching WME's DataModel
// (using a real Venue was discarded, see requirements section 3.1). Dragging
// only applies once a shape is in edit mode; see PolygonLayer (polygon-layer.js).

import { safeAddLayer, safeAddFeature, safeRemoveFeature } from './sdk-safe.js';

const LAYER_NAME = 'wme-area-manager-rectangle';

export class RectangleLayer {
  constructor(sdk) {
    this.sdk = sdk;
    safeAddLayer(sdk, {
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
      safeAddFeature(this.sdk, LAYER_NAME, feature);
      this.featureIds.push(feature.id);
    }
  }

  clear() {
    for (const featureId of this.featureIds) {
      safeRemoveFeature(this.sdk, LAYER_NAME, featureId);
    }
    this.featureIds = [];
  }
}
