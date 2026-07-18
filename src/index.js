import { RectangleLayer } from './map-layer.js';
import { PolygonLayer } from './polygon-layer.js';
import { SavedShapeLayer } from './saved-shape-layer.js';
import { initSidebar } from './sidebar.js';
import { initI18n } from './i18n.js';
import { loadDeleteShortcutKey } from './storage.js';

function initScript() {
  const sdk = unsafeWindow.getWmeSdk({
    scriptId: 'wme-area-manager',
    scriptName: 'WME Area Manager',
  });

  // Must run before any t() call, in particular before initSidebar() builds the panel.
  initI18n(sdk);

  sdk.Events.once({ eventName: 'wme-ready' }).then(() => {
    const layer = new RectangleLayer(sdk);
    const polygonLayer = new PolygonLayer(sdk, loadDeleteShortcutKey());
    const savedShapeLayer = new SavedShapeLayer(sdk);
    initSidebar({ sdk, layer, polygonLayer, savedShapeLayer });
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
