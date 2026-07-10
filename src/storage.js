// Persistence of saved rectangles via GM_setValue/GM_getValue.
// Entry structure: { id, nombre, lat, lon, nivel, zoom, area_km2, env, fechaCreacion }
// See requisitos_wme_area_manager.md, section 3.

const STORAGE_KEY = 'wme-area-manager:rectangles';

export function loadRectangles() {
  return GM_getValue(STORAGE_KEY, []);
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
