// Genera el enlace al punto central. Ver requisitos_wme_area_manager.md, sección 2 (punto 9).
// TODO (Fase 5): derivar `env` del entorno actual (window.location) en vez de usar
// siempre el valor por defecto 'row'.

export function buildEditorLink({ lat, lon, zoom, env = 'row' }) {
  const latStr = lat.toFixed(5);
  const lonStr = lon.toFixed(5);
  return `https://waze.com/editor?env=${env}&lat=${latStr}&lon=${lonStr}&marker=true&zoomLevel=${zoom}`;
}
