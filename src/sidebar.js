// Sidebar panel: placement mode, name field + save, list of saved rectangles
// with actions (load/center, copy link, rename, delete).
// See requisitos_wme_area_manager.md, section 2 (points 1, 6, 7, 10).
// Phase 1: placement + link only. Saving/listing arrive in Phases 2-3.

import { getConfigForRank } from './config.js';
import { buildRectangleFromCenter, buildDiagonals } from './geometry.js';
import { buildEditorLink } from './link.js';

const ASPECT_RATIOS = [
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '4:3', value: 4 / 3 },
];

export function initSidebar({ sdk, layer }) {
  sdk.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
    tabLabel.innerText = 'Area Manager';

    const aspectSelect = document.createElement('select');
    for (const { label, value } of ASPECT_RATIOS) {
      const option = document.createElement('option');
      option.value = value;
      option.innerText = label;
      aspectSelect.appendChild(option);
    }
    tabPane.appendChild(aspectSelect);

    const placeButton = document.createElement('button');
    placeButton.innerText = 'Colocar rectángulo';
    tabPane.appendChild(placeButton);

    const statusDiv = document.createElement('div');
    tabPane.appendChild(statusDiv);

    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.readOnly = true;
    linkInput.style.width = '100%';
    tabPane.appendChild(linkInput);

    placeButton.addEventListener('click', async () => {
      statusDiv.innerText = '';
      const userInfo = sdk.State.getUserInfo();
      if (!userInfo) return;
      const { zoom, areaKm2 } = getConfigForRank(userInfo.rank);

      try {
        const { coordinates: [lon, lat] } = await sdk.Map.drawPoint();

        const { polygon, bbox } = buildRectangleFromCenter({ lon, lat }, areaKm2, Number(aspectSelect.value));
        layer.draw(polygon, buildDiagonals(polygon));
        sdk.Map.zoomToExtent({ bbox });

        linkInput.value = buildEditorLink({ lat, lon, zoom });
      } catch (error) {
        statusDiv.innerText = `No se pudo colocar el rectángulo: ${error.message}. Prueba a acercar el zoom.`;
      }
    });
  });
}
