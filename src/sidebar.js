// Sidebar panel: placement mode, name field + save, list of saved rectangles
// with actions (load/center, copy link, rename, delete).
// See requisitos_wme_area_manager.md, section 2 (points 1, 5.1, 6, 7, 10).
// Phase 1: rectangle placement + link. Phase 2 adds the free-form polygon
// mode. Saving/listing arrive in Phases 3-4.

import { getConfigForRank } from './config.js';
import { buildRectangleFromCenter, buildDiagonals, polygonAreaKm2, polygonCenter } from './geometry.js';
import { buildEditorLink } from './link.js';

const ASPECT_RATIOS = [
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '4:3', value: 4 / 3 },
];

const SHAPES = [
  { label: 'Rectángulo', value: 'rectangle' },
  { label: 'Polígono', value: 'polygon' },
];

export function initSidebar({ sdk, layer, polygonLayer }) {
  sdk.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
    tabLabel.innerText = 'Area Manager';

    const shapeSelect = document.createElement('select');
    for (const { label, value } of SHAPES) {
      const option = document.createElement('option');
      option.value = value;
      option.innerText = label;
      shapeSelect.appendChild(option);
    }
    tabPane.appendChild(shapeSelect);

    const aspectSelect = document.createElement('select');
    for (const { label, value } of ASPECT_RATIOS) {
      const option = document.createElement('option');
      option.value = value;
      option.innerText = label;
      aspectSelect.appendChild(option);
    }
    tabPane.appendChild(aspectSelect);

    const placeButton = document.createElement('button');
    tabPane.appendChild(placeButton);

    const statusDiv = document.createElement('div');
    tabPane.appendChild(statusDiv);

    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.readOnly = true;
    linkInput.style.width = '100%';
    tabPane.appendChild(linkInput);

    function updateShapeUI() {
      const isRectangle = shapeSelect.value === 'rectangle';
      aspectSelect.style.display = isRectangle ? '' : 'none';
      placeButton.innerText = isRectangle ? 'Colocar rectángulo' : 'Colocar polígono';
    }
    shapeSelect.addEventListener('change', updateShapeUI);
    updateShapeUI();

    function updatePolygonStatus(polygon, { error } = {}) {
      if (error) {
        statusDiv.innerText = error;
        return;
      }
      const userInfo = sdk.State.getUserInfo();
      if (!userInfo || !polygon) return;
      const { level, zoom, areaKm2: maxAreaKm2 } = getConfigForRank(userInfo.rank);
      const areaKm2 = polygonAreaKm2(polygon);
      const valid = areaKm2 <= maxAreaKm2;
      polygonLayer.setValid(valid);
      statusDiv.innerText = valid
        ? `Área: ${areaKm2.toFixed(2)} km² — dentro del límite del nivel ${level} (máx. ${maxAreaKm2} km²)`
        : `Área: ${areaKm2.toFixed(2)} km² — supera el límite del nivel ${level} (máx. ${maxAreaKm2} km²)`;

      const { lon, lat } = polygonCenter(polygon.coordinates[0].slice(0, -1));
      linkInput.value = buildEditorLink({ lat, lon, zoom });
    }

    async function placeRectangle() {
      const userInfo = sdk.State.getUserInfo();
      if (!userInfo) return;
      const { zoom, areaKm2 } = getConfigForRank(userInfo.rank);

      const { coordinates: [lon, lat] } = await sdk.Map.drawPoint();

      const { polygon, bbox } = buildRectangleFromCenter({ lon, lat }, areaKm2, Number(aspectSelect.value));
      layer.draw(polygon, buildDiagonals(polygon));
      sdk.Map.zoomToExtent({ bbox });

      linkInput.value = buildEditorLink({ lat, lon, zoom });
    }

    async function placePolygon() {
      const polygon = await sdk.Map.drawPolygon();
      if (!polygon) {
        statusDiv.innerText = 'Dibujo cancelado.';
        return;
      }
      polygonLayer.draw(polygon, { onChange: updatePolygonStatus });
      updatePolygonStatus(polygon);
    }

    placeButton.addEventListener('click', async () => {
      statusDiv.innerText = '';
      try {
        if (shapeSelect.value === 'rectangle') {
          await placeRectangle();
        } else {
          await placePolygon();
        }
      } catch (error) {
        statusDiv.innerText = `No se pudo colocar la figura: ${error.message}. Prueba a acercar el zoom.`;
      }
    });
  });
}
