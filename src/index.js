import { RectangleLayer } from './map-layer.js';
import { initSidebar } from './sidebar.js';

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

// Using @grant (GM_setValue/GM_getValue) isolates the script's `window` from
// the page's real `window`: initialization must happen from `unsafeWindow`.
// See requisitos_wme_area_manager.md, section 3.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => unsafeWindow.SDK_INITIALIZED.then(initScript));
} else {
  unsafeWindow.SDK_INITIALIZED.then(initScript);
}
