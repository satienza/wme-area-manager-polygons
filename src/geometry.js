// Cálculo geodésico del cuadrado centrado en un punto.
// Ver requisitos_wme_area_manager.md, sección 3: usar Turf.js (turf.destination /
// turf.bbox) para que el área en km² sea correcta en cualquier latitud, en vez de
// deltas fijos de grados.
//
// TODO (Fase 1): `npm install @turf/turf` e implementar.

/**
 * @param {{lon: number, lat: number}} center
 * @param {number} areaKm2
 * @returns {GeoJSON.Polygon}
 */
export function buildSquareFromCenter(center, areaKm2) {
  throw new Error('Not implemented yet — ver Fase 1 de PLAN.md');
}
