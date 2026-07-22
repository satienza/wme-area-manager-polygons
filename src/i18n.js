// i18n scaffolding (Phase 7): dictionary per language + t(key) lookup.
// Only `es` exists for now — a second language plugs in by adding an entry
// to DICTIONARIES, no other code changes needed.
// See requisitos_wme_area_manager.md and PLAN.md, Fase 7.

const DICTIONARIES = {
  es: {
    tabLabel: 'Area Manager',
    shapeRectangle: 'Rectángulo',
    shapePolygon: 'Polígono',
    namePlaceholder: 'Nombre',
    save: 'Guardar',
    clearDrawing: 'Limpiar dibujo',
    nameRequired: 'El nombre es obligatorio para guardar.',
    nothingToSave: 'No hay ninguna figura para guardar.',
    saved: (nombre) => `Guardado "${nombre}".`,
    noSavedShapes: 'No hay figuras guardadas.',
    sectionNewItem: 'Nuevo item',
    sectionCurrentShape: 'Figura actual',
    sectionSaved: 'Guardadas',
    load: 'Cargar',
    edit: 'Editar',
    exportGeoJSON: 'GeoJSON',
    exportWKT: 'WKT',
    copyLink: 'Copiar enlace',
    rename: 'Renombrar',
    delete: 'Eliminar',
    linkCopied: 'Enlace copiado.',
    linkCopyFailed: 'No se pudo copiar automáticamente; usa el campo de enlace.',
    renamePrompt: 'Nuevo nombre:',
    placeRectangle: 'Colocar rectángulo',
    placePolygon: 'Colocar polígono',
    areaWithinLimit: (areaKm2, level, maxAreaKm2) =>
      `Área: ${areaKm2} km² — dentro del límite del nivel ${level} (máx. ${maxAreaKm2} km²)`,
    areaExceedsLimit: (areaKm2, level, maxAreaKm2) =>
      `Área: ${areaKm2} km² — supera el límite del nivel ${level} (máx. ${maxAreaKm2} km²)`,
    drawingCancelled: 'Dibujo cancelado.',
    placementFailed: (message) => `No se pudo colocar la figura: ${message}. Prueba a acercar el zoom.`,
    polygonEditHelp: (key) =>
      `Edición del polígono: clic en el borde añade un punto · clic en el interior arrastra la figura · ` +
      `clic en un vértice lo arrastra · pasar el ratón por un vértice y pulsar "${key}" lo borra.`,
    deleteShortcutLabel: 'Tecla para borrar vértice:',
    deleteShortcutSaved: (key) => `Atajo de borrado actualizado a "${key}".`,
    invalidShortcutKey: 'Introduce una única tecla.',
  },
  en: {
    tabLabel: 'Area Manager',
    shapeRectangle: 'Rectangle',
    shapePolygon: 'Polygon',
    namePlaceholder: 'Name',
    save: 'Save',
    clearDrawing: 'Clear drawing',
    nameRequired: 'A name is required to save.',
    nothingToSave: 'There is no shape to save.',
    saved: (nombre) => `Saved "${nombre}".`,
    noSavedShapes: 'No saved shapes.',
    sectionNewItem: 'New item',
    sectionCurrentShape: 'Current shape',
    sectionSaved: 'Saved',
    load: 'Load',
    edit: 'Edit',
    exportGeoJSON: 'GeoJSON',
    exportWKT: 'WKT',
    copyLink: 'Copy link',
    rename: 'Rename',
    delete: 'Delete',
    linkCopied: 'Link copied.',
    linkCopyFailed: 'Could not copy automatically; use the link field.',
    renamePrompt: 'New name:',
    placeRectangle: 'Place rectangle',
    placePolygon: 'Place polygon',
    areaWithinLimit: (areaKm2, level, maxAreaKm2) =>
      `Area: ${areaKm2} km² — within the level ${level} limit (max ${maxAreaKm2} km²)`,
    areaExceedsLimit: (areaKm2, level, maxAreaKm2) =>
      `Area: ${areaKm2} km² — exceeds the level ${level} limit (max ${maxAreaKm2} km²)`,
    drawingCancelled: 'Drawing cancelled.',
    placementFailed: (message) => `Could not place the shape: ${message}. Try zooming in.`,
    polygonEditHelp: (key) =>
      `Polygon editing: click the edge to add a point · click the interior to drag the shape · ` +
      `click a vertex to drag it · hover a vertex and press "${key}" to delete it.`,
    deleteShortcutLabel: 'Delete-vertex key:',
    deleteShortcutSaved: (key) => `Delete shortcut updated to "${key}".`,
    invalidShortcutKey: 'Enter a single key.',
  },
};

const DEFAULT_LANG = 'es';

function resolveLang(rawLocale) {
  const lang = String(rawLocale).split('-')[0];
  return DICTIONARIES[lang] ? lang : DEFAULT_LANG;
}

let activeLang = DEFAULT_LANG;

// Language comes from WME's own UI locale, not the browser's — an editor's
// browser and WME language settings aren't guaranteed to match, and the
// panel lives inside WME. Call once sdk is available, before building any
// UI that reads t().
export function initI18n(sdk) {
  try {
    const { localeCode } = sdk.Settings.getLocale();
    activeLang = resolveLang(localeCode);
  } catch (error) {
    console.warn('WME Area Manager: no se pudo detectar el idioma de WME; se usa español por defecto.', error);
    activeLang = DEFAULT_LANG;
  }
}

export function t(key, ...args) {
  const entry = DICTIONARIES[activeLang]?.[key] ?? DICTIONARIES[DEFAULT_LANG][key];
  return typeof entry === 'function' ? entry(...args) : entry;
}
