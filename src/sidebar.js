// Sidebar panel: placement mode, name field + save, list of saved rectangles
// with actions (load/center, edit, export, copy link, rename, delete).
// See requisitos_wme_area_manager.md, section 2 (points 1, 5.1, 6, 7, 10).
// Phase 1: rectangle placement + link. Phase 2 adds the free-form polygon
// mode. Phase 3 adds naming + save. Phase 4 adds the saved list and its actions.

import { getConfigForRank } from './config.js';
import {
  buildRectangleFromCenter,
  buildDiagonals,
  geometryBbox,
  polygonAreaKm2,
  polygonCenter,
  toGeoJSONFeature,
  toWKT,
} from './geometry.js';
import { buildEditorLink } from './link.js';
import { deleteRectangle, loadRectangles, renameRectangle, saveRectangle } from './storage.js';

const ASPECT_RATIOS = [
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '4:3', value: 4 / 3 },
];

const SHAPES = [
  { label: 'Rectángulo', value: 'rectangle' },
  { label: 'Polígono', value: 'polygon' },
];

// TODO (Phase 5): derive from window.location instead of always 'row'.
const DEFAULT_ENV = 'row';

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function initSidebar({ sdk, layer, polygonLayer, savedShapeLayer }) {
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

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Nombre';
    nameInput.style.width = '100%';
    tabPane.appendChild(nameInput);

    const saveButton = document.createElement('button');
    saveButton.innerText = 'Guardar';
    tabPane.appendChild(saveButton);

    const clearButton = document.createElement('button');
    clearButton.innerText = 'Limpiar dibujo';
    tabPane.appendChild(clearButton);

    const exportOutput = document.createElement('textarea');
    exportOutput.readOnly = true;
    exportOutput.rows = 3;
    exportOutput.style.width = '100%';
    tabPane.appendChild(exportOutput);

    const listContainer = document.createElement('div');
    tabPane.appendChild(listContainer);

    // The shape currently offered to "Guardar": carries `id` only while
    // editing an existing saved entry, so saving overwrites it (upsert by id)
    // instead of creating a duplicate. Fresh placements start id-less.
    let currentEntry = null;
    // The layer holding whatever is drawn right now (rectangle placement,
    // polygon edit, or a read-only saved shape) — target of "Limpiar dibujo".
    let activeLayer = null;
    // id of the entry currently shown read-only via "Cargar", if any.
    let shownEntryId = null;

    function updateCurrentEntry(entry) {
      currentEntry = { ...currentEntry, ...entry, env: DEFAULT_ENV };
    }

    function autofillName() {
      nameInput.value = `Polygon ${formatTimestamp(new Date())}`;
    }

    saveButton.addEventListener('click', () => {
      const nombre = nameInput.value.trim();
      if (!nombre) {
        statusDiv.innerText = 'El nombre es obligatorio para guardar.';
        return;
      }
      if (!currentEntry) {
        statusDiv.innerText = 'No hay ninguna figura para guardar.';
        return;
      }
      saveRectangle({ ...currentEntry, nombre });
      statusDiv.innerText = `Guardado "${nombre}".`;
      renderList();
    });

    clearButton.addEventListener('click', () => {
      activeLayer?.clear();
      activeLayer = null;
    });

    function renderList() {
      listContainer.innerHTML = '';
      const rectangles = loadRectangles();
      if (rectangles.length === 0) {
        listContainer.innerText = 'No hay figuras guardadas.';
        return;
      }
      for (const entry of rectangles) {
        listContainer.appendChild(buildEntryRow(entry));
      }
    }

    function buildEntryRow(entry) {
      const row = document.createElement('div');
      row.style.borderTop = '1px solid #ccc';
      row.style.padding = '4px 0';

      const title = document.createElement('div');
      title.innerText = `${entry.nombre} — nivel ${entry.nivel} — ${new Date(entry.fechaCreacion).toLocaleString()}`;
      row.appendChild(title);

      const actions = document.createElement('div');
      row.appendChild(actions);

      function addAction(label, onClick) {
        const button = document.createElement('button');
        button.innerText = label;
        button.addEventListener('click', onClick);
        actions.appendChild(button);
      }

      addAction('Cargar', () => {
        savedShapeLayer.draw(entry.geometry);
        sdk.Map.zoomToExtent({ bbox: geometryBbox(entry.geometry) });
        activeLayer = savedShapeLayer;
        shownEntryId = entry.id;
      });

      addAction('Editar', () => {
        currentEntry = { ...entry, env: DEFAULT_ENV };
        nameInput.value = entry.nombre;
        polygonLayer.draw(entry.geometry, { onChange: updatePolygonStatus });
        updatePolygonStatus(entry.geometry);
        activeLayer = polygonLayer;
      });

      addAction('GeoJSON', () => {
        exportOutput.value = JSON.stringify(toGeoJSONFeature(entry));
      });

      addAction('WKT', () => {
        exportOutput.value = toWKT(entry.geometry);
      });

      addAction('Copiar enlace', () => {
        const enlace = buildEditorLink({ lat: entry.lat, lon: entry.lon, zoom: entry.zoom, env: entry.env });
        navigator.clipboard.writeText(enlace).then(
          () => { statusDiv.innerText = 'Enlace copiado.'; },
          () => {
            linkInput.value = enlace;
            statusDiv.innerText = 'No se pudo copiar automáticamente; usa el campo de enlace.';
          },
        );
      });

      addAction('Renombrar', () => {
        const nombre = prompt('Nuevo nombre:', entry.nombre);
        if (!nombre) return;
        renameRectangle(entry.id, nombre);
        renderList();
      });

      addAction('Eliminar', () => {
        deleteRectangle(entry.id);
        if (currentEntry?.id === entry.id) {
          polygonLayer.clear();
          currentEntry = null;
        }
        if (shownEntryId === entry.id) {
          savedShapeLayer.clear();
          shownEntryId = null;
        }
        renderList();
      });

      return row;
    }

    renderList();

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
      updateCurrentEntry({ geometry: polygon, lat, lon, nivel: level, zoom, area_km2: areaKm2 });
    }

    async function placeRectangle() {
      const userInfo = sdk.State.getUserInfo();
      if (!userInfo) return;
      const { level, zoom, areaKm2 } = getConfigForRank(userInfo.rank);

      const { coordinates: [lon, lat] } = await sdk.Map.drawPoint();

      const { polygon, bbox } = buildRectangleFromCenter({ lon, lat }, areaKm2, Number(aspectSelect.value));
      currentEntry = null; // fresh placement, not an edit of a saved entry
      layer.draw(polygon, buildDiagonals(polygon));
      activeLayer = layer;
      sdk.Map.zoomToExtent({ bbox });

      linkInput.value = buildEditorLink({ lat, lon, zoom });
      updateCurrentEntry({ geometry: polygon, lat, lon, nivel: level, zoom, area_km2: polygonAreaKm2(polygon) });
      autofillName();
    }

    async function placePolygon() {
      const polygon = await sdk.Map.drawPolygon();
      if (!polygon) {
        statusDiv.innerText = 'Dibujo cancelado.';
        return;
      }
      currentEntry = null; // fresh placement, not an edit of a saved entry
      polygonLayer.draw(polygon, { onChange: updatePolygonStatus });
      activeLayer = polygonLayer;
      updatePolygonStatus(polygon);
      autofillName();
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
