// Capa propia del SDK para dibujar y arrastrar el rectángulo, sin tocar el
// DataModel de WME (se descartó usar un Venue real, ver requisitos sección 3.1).

const LAYER_NAME = 'wme-area-manager-rectangle';

export class RectangleLayer {
  constructor(sdk) {
    this.sdk = sdk;
    this.sdk.Map.addLayer({ layerName: LAYER_NAME });
    this.featureId = null;
    // TODO (Fase 4): registrar wme-map-mouse-down/move/up para el arrastre manual,
    // recalculando el centro y redibujando en cada movimiento.
  }

  draw(polygon) {
    this.clear();
    this.featureId = 'rectangle';
    this.sdk.Map.addFeatureToLayer({
      layerName: LAYER_NAME,
      feature: { id: this.featureId, type: 'Feature', geometry: polygon, properties: {} },
    });
  }

  clear() {
    if (this.featureId) {
      this.sdk.Map.removeFeatureFromLayer({ layerName: LAYER_NAME, featureId: this.featureId });
      this.featureId = null;
    }
  }
}
