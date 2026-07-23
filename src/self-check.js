// Self-check for the Phase 1 logic (no SDK): rank -> level/zoom/area mapping
// and geodesic calculation of the rectangle. Run with: node src/self-check.js

import assert from 'node:assert/strict';
import { getConfigForRank } from './config.js';
import {
  buildRectangleFromCenter,
  geometryBbox,
  nearestEdgeIndex,
  polygonAreaKm2,
  polygonCenter,
  toGeoJSONFeature,
  toWKT,
  translateRigid,
} from './geometry.js';
const { t, formatAreaLabel } = await import('./i18n.js');

assert.equal(getConfigForRank(0).level, 1);
assert.equal(getConfigForRank(2).zoom, 14);
assert.equal(getConfigForRank(4).areaKm2, 121.5);
assert.throws(() => getConfigForRank(-1));
// Ranks 5/6 (SDK's UserRank goes up to 6) aren't in the level 1-5 table;
// they fall back to the largest defined tier instead of throwing.
assert.equal(getConfigForRank(5).level, 6);
assert.equal(getConfigForRank(5).areaKm2, 121.5);
assert.equal(getConfigForRank(6).level, 7);
assert.equal(getConfigForRank(6).areaKm2, 121.5);

function checkRectangle(areaKm2, aspectRatio) {
  const center = { lon: -3.7, lat: 40.4 };
  const { polygon } = buildRectangleFromCenter(center, areaKm2, aspectRatio);
  const [ring] = polygon.coordinates;
  assert.equal(ring.length, 5);
  assert.deepEqual(ring[0], ring[4]);

  const lons = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  assert.ok(Math.abs((Math.min(...lons) + Math.max(...lons)) / 2 - center.lon) < 0.001);
  assert.ok(Math.abs((Math.min(...lats) + Math.max(...lats)) / 2 - center.lat) < 0.001);

  // Resulting area in km², from the actual width/height of the drawn rectangle.
  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * Math.cos((center.lat * Math.PI) / 180);
  const widthKm = (Math.max(...lons) - Math.min(...lons)) * kmPerDegLon;
  const heightKm = (Math.max(...lats) - Math.min(...lats)) * kmPerDegLat;
  assert.ok(Math.abs(widthKm * heightKm - areaKm2) < areaKm2 * 0.01);
  assert.ok(Math.abs(widthKm / heightKm - aspectRatio) < 0.01);

  return polygon;
}

checkRectangle(7.59, 1);
checkRectangle(7.59, 3 / 2);

// Phase 2: polygon area/validity and rough center.
const { polygon: squareKm7_59 } = buildRectangleFromCenter({ lon: -3.7, lat: 40.4 }, 7.59, 1);
assert.ok(Math.abs(polygonAreaKm2(squareKm7_59) - 7.59) < 7.59 * 0.01);

const { level: level1, areaKm2: maxAreaKm2Level1 } = getConfigForRank(0);
assert.equal(level1, 1);
assert.ok(polygonAreaKm2(squareKm7_59) <= maxAreaKm2Level1); // within its own level's cap
const { areaKm2: maxAreaKm2Level3 } = getConfigForRank(2); // level 3, max 30.37 km²... still fits
assert.ok(polygonAreaKm2(squareKm7_59) <= maxAreaKm2Level3);
assert.ok(!(121.5 <= maxAreaKm2Level1)); // a much larger area exceeds a level-1 cap

// Bugfix: dragging a shape across latitudes must preserve its physical
// area -- a naive same-degree-delta translation was inflating/shrinking it
// depending on drag direction (north/south).
const draggedCoords = translateRigid(
  squareKm7_59.coordinates[0].slice(0, -1),
  { lon: -3.7, lat: 40.4 },
  { lon: -3.7, lat: 10 },
);
const draggedPolygon = { type: 'Polygon', coordinates: [[...draggedCoords, draggedCoords[0]]] };
assert.ok(Math.abs(polygonAreaKm2(draggedPolygon) - 7.59) < 7.59 * 0.01);

const center = polygonCenter(squareKm7_59.coordinates[0].slice(0, -1));
assert.ok(Math.abs(center.lon - -3.7) < 0.001);
assert.ok(Math.abs(center.lat - 40.4) < 0.001);

// Phase 3: export helpers.
const entry = {
  id: 'abc',
  nombre: 'Test',
  lat: 40.4,
  lon: -3.7,
  nivel: 1,
  zoom: 15,
  area_km2: 7.59,
  env: 'row',
  fechaCreacion: '2026-01-01T00:00:00.000Z',
  geometry: squareKm7_59,
};
const feature = toGeoJSONFeature(entry);
assert.equal(feature.type, 'Feature');
assert.equal(feature.geometry, squareKm7_59);
assert.equal(feature.properties.nombre, 'Test');
assert.equal(feature.properties.geometry, undefined);

const wkt = toWKT(squareKm7_59);
assert.ok(wkt.startsWith('POLYGON(('));
assert.ok(wkt.endsWith('))'));
const [lon0, lat0] = squareKm7_59.coordinates[0][0];
assert.ok(wkt.includes(`${lon0} ${lat0}`));

// bbox for centering the map on a shape being edited (no Turf).
const bbox = geometryBbox(squareKm7_59);
const [ring] = squareKm7_59.coordinates;
const lons = ring.map((c) => c[0]);
const lats = ring.map((c) => c[1]);
assert.deepEqual(bbox, [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);

// Phase 6: nearest-edge test that places a vertex inserted by a click on
// the outline, in PolygonLayer. Ring order from buildRectangleFromCenter:
// [SW, SE, NE, NW].
const squareRing = squareKm7_59.coordinates[0];
const [sw, se, ne, nw] = squareRing.slice(0, -1);
const midpoint = ([x1, y1], [x2, y2]) => [(x1 + x2) / 2, (y1 + y2) / 2];
assert.equal(nearestEdgeIndex(midpoint(sw, se), [sw, se, ne, nw]), 0); // south edge
assert.equal(nearestEdgeIndex(midpoint(se, ne), [sw, se, ne, nw]), 1); // east edge
assert.equal(nearestEdgeIndex(midpoint(nw, sw), [sw, se, ne, nw]), 3); // west edge (wraps NW -> SW)

// Phase 7: i18n lookup — plain string and interpolated function. Language
// defaults to `es` until initI18n(sdk) runs, which this test never calls.
assert.equal(t('save'), 'Guardar');
assert.equal(t('saved', 'Test'), 'Guardado "Test".');

// Live area/limit label (map overlay, polygon-layer.js): comma decimal in
// `es` (the default language here), area to 1 decimal, percentage to 2.
assert.equal(formatAreaLabel(119.1, 121.5), '119,1 (98,02%)');
assert.equal(formatAreaLabel(121.5, 121.5), '121,5 (100,00%)');

console.log('self-check OK');
