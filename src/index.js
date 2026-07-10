import { RectangleLayer } from './map-layer.js';
import { initSidebar } from './sidebar.js';
// config.js, geometry.js y link.js se importarán desde sidebar.js según se
// vayan implementando las Fases 1-3 del PLAN.md.

function initScript() {
  const sdk = unsafeWindow.getWmeSdk({
    scriptId: 'wme-area-manager',
    scriptName: 'WME Area Manager',
  });

  sdk.Events.once({ eventName: 'wme-ready' }).then(() => {
    const layer = new RectangleLayer(sdk);
    initSidebar({ sdk, layer });
  });
}

// El uso de @grant (GM_setValue/GM_getValue) aísla el `window` del script del
// `window` real de la página: hay que inicializar desde `unsafeWindow`.
// Ver requisitos_wme_area_manager.md, sección 3.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => unsafeWindow.SDK_INITIALIZED.then(initScript));
} else {
  unsafeWindow.SDK_INITIALIZED.then(initScript);
}
