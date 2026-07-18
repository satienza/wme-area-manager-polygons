// Editor level -> zoom / area rule.
// See requisitos_wme_area_manager.md, section 2 (point 4).
export const LEVEL_RULES = [
  { levels: [1, 2], zoom: 15, areaKm2: 7.59 },
  { levels: [3], zoom: 14, areaKm2: 30.37 },
  { levels: [4, 5], zoom: 13, areaKm2: 121.5 },
];

/**
 * @param {number} rank - rank exposed by State.getUserInfo() (SDK). The SDK's
 *   `UserRank` type confirms this is 0-6 (7 values), but `LEVEL_RULES` above
 *   only encodes the levels 1-5 from the community wiki table — ranks 5 and
 *   6 (Area/Country Managers) fall back to the largest defined tier below
 *   instead of throwing. That cap is a conservative placeholder, not a
 *   confirmed value: it still needs checking against a live rank-5/6 account
 *   (see requisitos_wme_area_manager.md, section 5).
 * @returns {{ level: number, zoom: number, areaKm2: number }}
 */
export function getConfigForRank(rank) {
  const level = rank + 1;
  if (level < 1) {
    throw new Error(`Rank de usuario inválido: ${rank}`);
  }
  const rule = LEVEL_RULES.find((r) => r.levels.includes(level)) ?? LEVEL_RULES[LEVEL_RULES.length - 1];
  return { level, zoom: rule.zoom, areaKm2: rule.areaKm2 };
}
