// Self-check for the Phase 1 logic (no SDK): rank -> level/zoom/area mapping
// and geodesic calculation of the rectangle. Run with: node src/self-check.js

import assert from 'node:assert/strict';
import { getConfigForRank } from './config.js';
import { buildRectangleFromCenter, buildDiagonals, polygonAreaKm2, polygonCenter } from './geometry.js';

assert.equal(getConfigForRank(0).level, 1);
assert.equal(getConfigForRank(2).zoom, 14);
assert.equal(getConfigForRank(4).areaKm2, 121.5);
assert.throws(() => getConfigForRank(99));

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
const polygon32 = checkRectangle(7.59, 3 / 2);

const [diag1, diag2] = buildDiagonals(polygon32);
for (const diagonal of [diag1, diag2]) {
  assert.equal(diagonal.coordinates.length, 2);
  const [[x1, y1], [x2, y2]] = diagonal.coordinates;
  const midpoint = [(x1 + x2) / 2, (y1 + y2) / 2];
  assert.ok(Math.abs(midpoint[0] - -3.7) < 0.001);
  assert.ok(Math.abs(midpoint[1] - 40.4) < 0.001);
}

// Phase 2: polygon area/validity and rough center.
const { polygon: squareKm7_59 } = buildRectangleFromCenter({ lon: -3.7, lat: 40.4 }, 7.59, 1);
assert.ok(Math.abs(polygonAreaKm2(squareKm7_59) - 7.59) < 7.59 * 0.01);

const { level: level1, areaKm2: maxAreaKm2Level1 } = getConfigForRank(0);
assert.equal(level1, 1);
assert.ok(polygonAreaKm2(squareKm7_59) <= maxAreaKm2Level1); // within its own level's cap
const { areaKm2: maxAreaKm2Level3 } = getConfigForRank(2); // level 3, max 30.37 km²... still fits
assert.ok(polygonAreaKm2(squareKm7_59) <= maxAreaKm2Level3);
assert.ok(!(121.5 <= maxAreaKm2Level1)); // a much larger area exceeds a level-1 cap

const center = polygonCenter(squareKm7_59.coordinates[0].slice(0, -1));
assert.ok(Math.abs(center.lon - -3.7) < 0.001);
assert.ok(Math.abs(center.lat - 40.4) < 0.001);

console.log('self-check OK');
