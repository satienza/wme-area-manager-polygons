// Persistence of saved rectangles via GM_setValue/GM_getValue.
// Entry structure: { id, nombre, tipo, lat, lon, nivel, zoom, area_km2, env, fechaCreacion, geometry }
// `geometry` is the actual traced GeoJSON.Polygon (rectangle or free
// polygon), not recalculated from nivel/lat/lon, so it can be reproduced and
// exported as-is (see geometry.js: toGeoJSONFeature/toWKT). `tipo` is
// 'rectangle' | 'polygon' and drives whether "Editar" allows vertex-level
// edits (see polygon-layer.js, `editable`) — entries saved before this field
// existed are `undefined` and default to editable.
// See requisitos_wme_area_manager.md, section 3.

import { DEFAULT_DELETE_SHORTCUT_KEY } from './polygon-layer.js';

const STORAGE_KEY = 'wme-area-manager:rectangles';
const SHORTCUT_KEY_STORAGE_KEY = 'wme-area-manager:delete-shortcut-key';

export function loadRectangles() {
  const raw = GM_getValue(STORAGE_KEY, []);
  if (!Array.isArray(raw)) {
    console.warn('WME Area Manager: guardado corrupto en GM_getValue (no es una lista); se ignora.', raw);
    return [];
  }
  return raw.filter((entry) => {
    const ok = entry && typeof entry === 'object' && entry.id && entry.geometry;
    if (!ok) console.warn('WME Area Manager: entrada guardada corrupta; se descarta.', entry);
    return ok;
  });
}

export function loadDeleteShortcutKey() {
  return GM_getValue(SHORTCUT_KEY_STORAGE_KEY, DEFAULT_DELETE_SHORTCUT_KEY);
}

export function saveDeleteShortcutKey(key) {
  GM_setValue(SHORTCUT_KEY_STORAGE_KEY, key);
}

function persist(rectangles) {
  GM_setValue(STORAGE_KEY, rectangles);
}

export function saveRectangle(rectangle) {
  const rectangles = loadRectangles();
  const id = rectangle.id ?? crypto.randomUUID();
  const index = rectangles.findIndex((r) => r.id === id);
  const entry = {
    ...rectangle,
    id,
    fechaCreacion: rectangle.fechaCreacion ?? new Date().toISOString(),
  };
  if (index >= 0) {
    rectangles[index] = entry;
  } else {
    rectangles.push(entry);
  }
  persist(rectangles);
  return entry;
}

export function renameRectangle(id, nombre) {
  const rectangles = loadRectangles();
  const entry = rectangles.find((r) => r.id === id);
  if (!entry) throw new Error(`Rectángulo ${id} no encontrado`);
  entry.nombre = nombre;
  persist(rectangles);
  return entry;
}

export function deleteRectangle(id) {
  const rectangles = loadRectangles().filter((r) => r.id !== id);
  persist(rectangles);
}
