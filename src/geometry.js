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
 * Rectangle diagonals, so the user can see where the center falls.
 * @param {GeoJSON.Polygon} polygon - returned by buildRectangleFromCenter.
 * @returns {GeoJSON.LineString[]}
 */
export function buildDiagonals(polygon) {
  const [sw, se, ne, nw] = polygon.coordinates[0];
  return [
    { type: 'LineString', coordinates: [sw, ne] },
    { type: 'LineString', coordinates: [se, nw] },
  ];
}
