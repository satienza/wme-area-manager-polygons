// Editor level -> zoom / area rule.
// See requisitos_wme_area_manager.md, section 2 (point 4).
export const LEVEL_RULES = [
  { levels: [1, 2], zoom: 15, areaKm2: 7.59 },
  { levels: [3], zoom: 14, areaKm2: 30.37 },
  { levels: [4, 5], zoom: 13, areaKm2: 121.5 },
];

/**
 * @param {number} rank - rank exposed by State.getUserInfo() (SDK).
 * @returns {{ level: number, zoom: number, areaKm2: number }}
 */
export function getConfigForRank(rank) {
  // TODO (Phase 5): confirm the actual rank (SDK) -> level (1-5) mapping with
  // accounts of different levels. Provisionally assumes a 0-indexed rank here.
  const level = rank + 1;
  const rule = LEVEL_RULES.find((r) => r.levels.includes(level));
  if (!rule) {
    throw new Error(`No hay regla de área definida para el nivel ${level} (rank ${rank})`);
  }
  return { level, zoom: rule.zoom, areaKm2: rule.areaKm2 };
}
