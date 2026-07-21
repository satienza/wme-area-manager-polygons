// Geodesic calculation of the rectangle centered on a point.
// See requisitos_wme_area_manager.md, section 3: use Turf.js (turf.destination)
// so the area in km² is correct at any latitude, instead of fixed degree
// deltas.

import destination from '@turf/destination';
import area from '@turf/area';
import { point } from '@turf/helpers';

/**
 * @param {{lon: number, lat: number}} center
 * @param {number} areaKm2 - total area fixed by the editor level.
 * @param {number} [aspectRatio=1] - width/height. 1 = square, 1.5 = 3:2, etc.
 *   The area always stays equal to `areaKm2`; only the shape changes.
 * @returns {{ polygon: GeoJSON.Polygon, bbox: [number, number, number, number] }}
 */
export function buildRectangleFromCenter(center, areaKm2, aspectRatio = 1) {
  const heightKm = Math.sqrt(areaKm2 / aspectRatio);
  const widthKm = aspectRatio * heightKm;
  const halfWidthKm = widthKm / 2;
  const halfHeightKm = heightKm / 2;

  const origin = point([center.lon, center.lat]);
  const [, northLat] = destination(origin, halfHeightKm, 0, { units: 'kilometers' }).geometry.coordinates;
  const [, southLat] = destination(origin, halfHeightKm, 180, { units: 'kilometers' }).geometry.coordinates;
  const [eastLon] = destination(origin, halfWidthKm, 90, { units: 'kilometers' }).geometry.coordinates;
  const [westLon] = destination(origin, halfWidthKm, 270, { units: 'kilometers' }).geometry.coordinates;

  const polygon = {
    type: 'Polygon',
    coordinates: [[
      [westLon, southLat],
      [eastLon, southLat],
      [eastLon, northLat],
      [westLon, northLat],
      [westLon, southLat],
    ]],
  };

  return { polygon, bbox: [westLon, southLat, eastLon, northLat] };
}

/**
 * Geodesic area of a free-form polygon.
 * @param {GeoJSON.Polygon} polygon
 * @returns {number} area in km².
 */
export function polygonAreaKm2(polygon) {
  return area(polygon) / 1_000_000;
}

/**
 * Rough planar center of a ring, for placing the editor link marker.
 * Good enough at the km² scale this script works with; not a geodesic
 * centroid.
 * @param {GeoJSON.Position[]} coordinates - ring without the closing point.
 * @returns {{ lon: number, lat: number }}
 */
export function polygonCenter(coordinates) {
  const lon = coordinates.reduce((sum, [x]) => sum + x, 0) / coordinates.length;
  const lat = coordinates.reduce((sum, [, y]) => sum + y, 0) / coordinates.length;
  return { lon, lat };
}

/**
 * Nearest edge of a ring to a point (planar distance, no Turf needed). Used
 * to find where a new vertex should be inserted when the user clicks on the
 * polygon's outline.
 * @param {GeoJSON.Position} pointCoord - [lon, lat].
 * @param {GeoJSON.Position[]} coordinates - ring without the closing point.
 * @returns {number} index i such that the new vertex goes between
 *   coordinates[i] and coordinates[i+1] (wrapping to 0 after the last).
 */
export function nearestEdgeIndex([x, y], coordinates) {
  let bestIndex = 0;
  let bestDistSq = Infinity;
  const n = coordinates.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = coordinates[i];
    const [x2, y2] = coordinates[(i + 1) % n];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const distSq = (x - px) ** 2 + (y - py) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Bounding box of a polygon's outer ring, from raw min/max — no Turf needed.
 * Used to center/zoom the map on a saved shape (see saved-shape-layer.js).
 * @param {GeoJSON.Polygon} geometry
 * @returns {[number, number, number, number]} [west, south, east, north]
 */
export function geometryBbox(geometry) {
  const [ring] = geometry.coordinates;
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/**
 * Wraps a saved entry's `geometry` in a GeoJSON Feature carrying the rest of
 * the entry as properties. See requisitos_wme_area_manager.md, section 2 (point 7).
 * @param {{ geometry: GeoJSON.Polygon, [key: string]: any }} entry
 * @returns {GeoJSON.Feature}
 */
export function toGeoJSONFeature(entry) {
  const { geometry, ...properties } = entry;
  return { type: 'Feature', geometry, properties };
}

/**
 * Manual GeoJSON.Polygon -> WKT conversion (no new dependency).
 * @param {GeoJSON.Polygon} polygon
 * @returns {string}
 */
export function toWKT(polygon) {
  const rings = polygon.coordinates
    .map((ring) => `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`)
    .join(', ');
  return `POLYGON(${rings})`;
}
