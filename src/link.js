// Builds the link to the center point. See requisitos_wme_area_manager.md, section 2 (point 9).
// TODO (Phase 5): derive `env` from the current environment (window.location) instead of
// always using the default value 'row'.

export function buildEditorLink({ lat, lon, zoom, env = 'row' }) {
  const latStr = lat.toFixed(5);
  const lonStr = lon.toFixed(5);
  return `https://waze.com/editor?env=${env}&lat=${latStr}&lon=${lonStr}&marker=true&zoomLevel=${zoom}`;
}
