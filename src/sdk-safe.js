// Thin try/catch wrappers around the WME SDK Map calls the three custom
// layers (map-layer.js, polygon-layer.js, saved-shape-layer.js) use. WME can
// tear down a script's layer on some view changes, so a stale layer/feature
// reference must log and move on instead of breaking the whole panel.
// See PLAN.md, Fase 8 ("manejo de errores ... capas inexistentes").

export function safeAddLayer(sdk, options) {
  try {
    sdk.Map.addLayer(options);
  } catch (error) {
    console.warn(`WME Area Manager: no se pudo crear la capa "${options.layerName}".`, error);
  }
}

export function safeAddFeature(sdk, layerName, feature) {
  try {
    sdk.Map.addFeatureToLayer({ layerName, feature });
  } catch (error) {
    console.warn(`WME Area Manager: no se pudo añadir "${feature.id}" a la capa "${layerName}".`, error);
  }
}

// Silent on failure: clear() calls this for features that may already be
// gone (layer reset by WME, or already removed), which is the expected case,
// not an exceptional one.
export function safeRemoveFeature(sdk, layerName, featureId) {
  try {
    sdk.Map.removeFeatureFromLayer({ layerName, featureId });
  } catch {
    // ignored: feature/layer already gone
  }
}
