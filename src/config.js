// Regla nivel de editor -> zoom / área.
// Ver requisitos_wme_area_manager.md, sección 2 (punto 4).
export const LEVEL_RULES = [
  { levels: [1, 2], zoom: 15, areaKm2: 7.59 },
  { levels: [3], zoom: 14, areaKm2: 30.37 },
  { levels: [4, 5], zoom: 13, areaKm2: 121.5 },
];

/**
 * @param {number} rank - rank expuesto por State.userInfo (SDK).
 * @returns {{ level: number, zoom: number, areaKm2: number }}
 */
export function getConfigForRank(rank) {
  // TODO (Fase 5): confirmar el mapeo real rank (SDK) -> nivel (1-5) con cuentas
  // de distinto nivel. Se asume aquí, provisionalmente, rank 0-indexado.
  const level = rank + 1;
  const rule = LEVEL_RULES.find((r) => r.levels.includes(level));
  if (!rule) {
    throw new Error(`No hay regla de área definida para el nivel ${level} (rank ${rank})`);
  }
  return { level, zoom: rule.zoom, areaKm2: rule.areaKm2 };
}
