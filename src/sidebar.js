// Sidebar panel: placement mode, name field + save, list of saved rectangles
// with actions (edit, export, copy link, rename, delete).
// See requisitos_wme_area_manager.md, section 2 (points 1, 5.1, 6, 7, 10).
// Phase 1: rectangle placement + link. Phase 2 adds the free-form polygon
// mode. Phase 3 adds naming + save. Phase 4 adds the saved list and its actions.

import { getConfigForRank } from './config.js';
import {
  buildRectangleFromCenter,
  geometryBbox,
  polygonAreaKm2,
  polygonCenter,
  toGeoJSONFeature,
  toWKT,
} from './geometry.js';
import { buildEditorLink } from './link.js';
import {
  deleteRectangle,
  loadDeleteShortcutKey,
  loadRectangles,
  renameRectangle,
  saveDeleteShortcutKey,
  saveRectangle,
} from './storage.js';
import { t } from './i18n.js';
import { version } from '../package.json';

const ASPECT_RATIOS = [
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '4:3', value: 4 / 3 },
];

// The SDK's own data model is more reliable than parsing window.location
// (whose URL scheme isn't guaranteed): Country.regionCode already uses the
// same 'usa' | 'row' | 'il' values as the link's `env` parameter. Falls back
// to 'row' per requisitos_wme_area_manager.md, section 5.
function detectEnv(sdk) {
  try {
    const country = sdk.DataModel.Countries.getTopCountry();
    if (country?.regionCode) return country.regionCode;
  } catch (error) {
    console.warn('WME Area Manager: no se pudo detectar el entorno (env); se usa "row" por defecto.', error);
  }
  return 'row';
}

// WME already serves Font Awesome on the editor page itself, so a plain
// `<i class="fa fa-...">` is enough — no new dependency. See PLAN.md, Fase 9.
function buildIcon(name) {
  const icon = document.createElement('i');
  icon.className = `fa fa-${name}`;
  return icon;
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function initSidebar({ sdk, polygonLayer }) {
  const DEFAULT_ENV = detectEnv(sdk);

  // Built here (not at module scope) so its t() calls read the language
  // initI18n(sdk) already resolved — see src/index.js.
  const SHAPES = [
    { label: t('shapeRectangle'), value: 'rectangle' },
    { label: t('shapePolygon'), value: 'polygon' },
  ];

  sdk.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
    tabLabel.innerText = t('tabLabel');

    // Single injected stylesheet, scoped to this tab's markup only (no
    // external sheet, no new dependency) — see PLAN.md, Fase 9.
    const style = document.createElement('style');
    style.textContent = `
      .wme-am-section { border: 1px solid #ccc; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
      .wme-am-section-header { font-weight: bold; margin-bottom: 6px; }
      .wme-am-section > *:not(:last-child) { margin-bottom: 6px; }
      .wme-am-entry-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
      .wme-am-entry-table td { border: 1px solid #ccc; padding: 2px 6px; text-align: left; }
      .wme-am-entry-table tr:first-child td { font-weight: bold; }
      .wme-am-actions-row { display: flex; gap: 4px; margin-bottom: 4px; }
      .wme-am-section--disabled { opacity: 0.5; pointer-events: none; }
    `;
    tabPane.appendChild(style);

    const newItemSection = document.createElement('div');
    newItemSection.className = 'wme-am-section';
    const newItemHeader = document.createElement('div');
    newItemHeader.className = 'wme-am-section-header';
    newItemHeader.innerText = t('sectionNewItem');
    newItemSection.appendChild(newItemHeader);
    tabPane.appendChild(newItemSection);

    const currentShapeSection = document.createElement('div');
    currentShapeSection.className = 'wme-am-section';
    const currentShapeHeader = document.createElement('div');
    currentShapeHeader.className = 'wme-am-section-header';
    currentShapeHeader.innerText = t('sectionCurrentShape');
    currentShapeSection.appendChild(currentShapeHeader);
    tabPane.appendChild(currentShapeSection);

    const savedSection = document.createElement('div');
    savedSection.className = 'wme-am-section';
    const savedHeader = document.createElement('div');
    savedHeader.className = 'wme-am-section-header';
    savedHeader.innerText = t('sectionSaved');
    savedSection.appendChild(savedHeader);
    tabPane.appendChild(savedSection);

    const versionFooter = document.createElement('div');
    versionFooter.style.textAlign = 'center';
    versionFooter.style.color = '#888';
    versionFooter.style.fontSize = '0.85em';
    versionFooter.innerText = `v${version}`;
    tabPane.appendChild(versionFooter);

    const shapeSelect = document.createElement('select');
    for (const { label, value } of SHAPES) {
      const option = document.createElement('option');
      option.value = value;
      option.innerText = label;
      shapeSelect.appendChild(option);
    }
    newItemSection.appendChild(shapeSelect);

    const aspectSelect = document.createElement('select');
    for (const { label, value } of ASPECT_RATIOS) {
      const option = document.createElement('option');
      option.value = value;
      option.innerText = label;
      aspectSelect.appendChild(option);
    }
    newItemSection.appendChild(aspectSelect);

    const polygonHelpDiv = document.createElement('div');
    newItemSection.appendChild(polygonHelpDiv);

    const shortcutLabel = document.createElement('label');
    shortcutLabel.innerText = t('deleteShortcutLabel');
    newItemSection.appendChild(shortcutLabel);

    const shortcutInput = document.createElement('input');
    shortcutInput.type = 'text';
    shortcutInput.maxLength = 1;
    shortcutInput.style.width = '2em';
    shortcutInput.value = loadDeleteShortcutKey();
    shortcutLabel.appendChild(shortcutInput);

    function refreshPolygonHelp() {
      polygonHelpDiv.innerText = t('polygonEditHelp', shortcutInput.value);
    }

    shortcutInput.addEventListener('change', () => {
      const key = shortcutInput.value.trim();
      if (key.length !== 1) {
        statusDiv.innerText = t('invalidShortcutKey');
        shortcutInput.value = loadDeleteShortcutKey();
        return;
      }
      saveDeleteShortcutKey(key);
      polygonLayer.setDeleteShortcutKey(key);
      statusDiv.innerText = t('deleteShortcutSaved', key);
      refreshPolygonHelp();
    });

    const placeButton = document.createElement('button');
    newItemSection.appendChild(placeButton);

    const statusDiv = document.createElement('div');
    currentShapeSection.appendChild(statusDiv);

    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.readOnly = true;
    linkInput.style.width = '100%';
    currentShapeSection.appendChild(linkInput);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = t('namePlaceholder');
    nameInput.style.width = '100%';
    currentShapeSection.appendChild(nameInput);

    const saveButton = document.createElement('button');
    saveButton.appendChild(buildIcon('save'));
    saveButton.appendChild(document.createTextNode(' ' + t('save')));
    currentShapeSection.appendChild(saveButton);

    const clearButton = document.createElement('button');
    clearButton.innerText = t('clearDrawing');
    currentShapeSection.appendChild(clearButton);

    const exportOutput = document.createElement('textarea');
    exportOutput.readOnly = true;
    exportOutput.rows = 3;
    exportOutput.style.width = '100%';
    currentShapeSection.appendChild(exportOutput);

    const listContainer = document.createElement('div');
    savedSection.appendChild(listContainer);

    // The shape currently offered to "Guardar": carries `id` only while
    // editing an existing saved entry, so saving overwrites it (upsert by id)
    // instead of creating a duplicate. Fresh placements start id-less.
    let currentEntry = null;
    // The layer holding whatever is drawn right now (rectangle placement or
    // polygon edit) — target of "Limpiar dibujo".
    let activeLayer = null;
    // JSON snapshot of `currentEntry.geometry` as of the last save (or the
    // load from a saved entry); `null` means nothing has been saved yet
    // (fresh, never-saved placement). Compared against the live geometry to
    // detect unsaved changes before switching to edit another item.
    let savedSnapshot = null;

    function updateCurrentEntry(entry) {
      currentEntry = { ...currentEntry, ...entry, env: DEFAULT_ENV };
    }

    function autofillName() {
      nameInput.value = `Polygon ${formatTimestamp(new Date())}`;
    }

    function isDirty() {
      return currentEntry != null && JSON.stringify(currentEntry.geometry) !== savedSnapshot;
    }

    function setEditingActive(active) {
      newItemSection.classList.toggle('wme-am-section--disabled', active);
    }

    function saveCurrent(nombre) {
      saveRectangle({ ...currentEntry, nombre });
      savedSnapshot = JSON.stringify(currentEntry.geometry);
      renderList();
    }

    saveButton.addEventListener('click', () => {
      const nombre = nameInput.value.trim();
      if (!nombre) {
        statusDiv.innerText = t('nameRequired');
        return;
      }
      if (!currentEntry) {
        statusDiv.innerText = t('nothingToSave');
        return;
      }
      saveCurrent(nombre);
      statusDiv.innerText = t('saved', nombre);
    });

    clearButton.addEventListener('click', () => {
      activeLayer?.clear();
      activeLayer = null;
      setEditingActive(false);
    });

    function renderList() {
      listContainer.innerHTML = '';
      const rectangles = loadRectangles();
      if (rectangles.length === 0) {
        listContainer.innerText = t('noSavedShapes');
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

      const table = document.createElement('table');
      table.className = 'wme-am-entry-table';

      const nameRow = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.colSpan = 3;
      nameCell.innerText = entry.nombre;
      nameRow.appendChild(nameCell);
      table.appendChild(nameRow);

      const detailRow = document.createElement('tr');
      const fecha = new Date(entry.fechaCreacion);
      for (const text of [`N${entry.nivel}`, fecha.toLocaleDateString('es-ES'), fecha.toLocaleTimeString('es-ES')]) {
        const cell = document.createElement('td');
        cell.innerText = text;
        detailRow.appendChild(cell);
      }
      table.appendChild(detailRow);

      row.appendChild(table);

      const actionsRow1 = document.createElement('div');
      actionsRow1.className = 'wme-am-actions-row';
      row.appendChild(actionsRow1);

      const actionsRow2 = document.createElement('div');
      actionsRow2.className = 'wme-am-actions-row';
      row.appendChild(actionsRow2);

      function addAction(container, label, onClick, iconName) {
        const button = document.createElement('button');
        if (iconName) button.appendChild(buildIcon(iconName));
        button.appendChild(document.createTextNode(iconName ? ' ' + label : label));
        button.addEventListener('click', onClick);
        container.appendChild(button);
      }

      // Row 1: Edit, Rename, Delete. Row 2: Link, GeoJson, WKT.
      addAction(actionsRow1, t('edit'), () => {
        if (currentEntry?.id === entry.id) return; // already the active item
        if (activeLayer === polygonLayer && isDirty()) {
          const guardar = confirm(t('confirmSaveChanges', currentEntry.nombre ?? nameInput.value));
          if (guardar) saveCurrent(nameInput.value.trim() || currentEntry.nombre);
        }
        currentEntry = { ...entry, env: DEFAULT_ENV };
        savedSnapshot = JSON.stringify(entry.geometry);
        nameInput.value = entry.nombre;
        // Entries saved before `tipo` existed default to editable, matching
        // their current (unrestricted) behavior until re-saved.
        polygonLayer.draw(entry.geometry, { onChange: updatePolygonStatus, editable: entry.tipo !== 'rectangle' });
        updatePolygonStatus(entry.geometry);
        sdk.Map.zoomToExtent({ bbox: geometryBbox(entry.geometry) });
        activeLayer = polygonLayer;
        setEditingActive(true);
      }, 'edit');

      addAction(actionsRow1, t('rename'), () => {
        const nombre = prompt(t('renamePrompt'), entry.nombre);
        if (!nombre) return;
        renameRectangle(entry.id, nombre);
        renderList();
      }, 'tag');

      addAction(actionsRow1, t('delete'), () => {
        deleteRectangle(entry.id);
        if (currentEntry?.id === entry.id) {
          polygonLayer.clear();
          currentEntry = null;
          activeLayer = null;
          savedSnapshot = null;
          setEditingActive(false);
        }
        renderList();
      }, 'trash');

      addAction(actionsRow2, t('copyLink'), () => {
        const enlace = buildEditorLink({ lat: entry.lat, lon: entry.lon, zoom: entry.zoom, env: entry.env });
        navigator.clipboard.writeText(enlace).then(
          () => { statusDiv.innerText = t('linkCopied'); },
          () => {
            linkInput.value = enlace;
            statusDiv.innerText = t('linkCopyFailed');
          },
        );
      }, 'link');

      addAction(actionsRow2, t('exportGeoJSON'), () => {
        exportOutput.value = JSON.stringify(toGeoJSONFeature(entry));
      });

      addAction(actionsRow2, t('exportWKT'), () => {
        exportOutput.value = toWKT(entry.geometry);
      });

      return row;
    }

    renderList();

    function updateShapeUI() {
      const isRectangle = shapeSelect.value === 'rectangle';
      aspectSelect.style.display = isRectangle ? '' : 'none';
      polygonHelpDiv.style.display = isRectangle ? 'none' : '';
      shortcutLabel.style.display = isRectangle ? 'none' : '';
      placeButton.innerText = isRectangle ? t('placeRectangle') : t('placePolygon');
    }
    shapeSelect.addEventListener('change', updateShapeUI);
    refreshPolygonHelp();
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
        ? t('areaWithinLimit', areaKm2.toFixed(2), level, maxAreaKm2)
        : t('areaExceedsLimit', areaKm2.toFixed(2), level, maxAreaKm2);

      const { lon, lat } = polygonCenter(polygon.coordinates[0].slice(0, -1));
      linkInput.value = buildEditorLink({ lat, lon, zoom });
      updateCurrentEntry({ geometry: polygon, lat, lon, nivel: level, zoom, area_km2: areaKm2 });
    }

    async function placeRectangle() {
      const userInfo = sdk.State.getUserInfo();
      if (!userInfo) return;
      const { areaKm2 } = getConfigForRank(userInfo.rank);

      const { coordinates: [lon, lat] } = await sdk.Map.drawPoint();

      const { polygon, bbox } = buildRectangleFromCenter({ lon, lat }, areaKm2, Number(aspectSelect.value));
      currentEntry = null; // fresh placement, not an edit of a saved entry
      savedSnapshot = null;
      updateCurrentEntry({ tipo: 'rectangle' });
      // Rectangles are rigid (size fixed by the editor level): edit mode
      // only allows whole-figure translation, no vertex-level edits.
      polygonLayer.draw(polygon, { onChange: updatePolygonStatus, editable: false });
      activeLayer = polygonLayer;
      setEditingActive(true);
      sdk.Map.zoomToExtent({ bbox });
      updatePolygonStatus(polygon);
      autofillName();
    }

    async function placePolygon() {
      const polygon = await sdk.Map.drawPolygon();
      if (!polygon) {
        statusDiv.innerText = t('drawingCancelled');
        return;
      }
      currentEntry = null; // fresh placement, not an edit of a saved entry
      savedSnapshot = null;
      updateCurrentEntry({ tipo: 'polygon' });
      polygonLayer.draw(polygon, { onChange: updatePolygonStatus, editable: true });
      activeLayer = polygonLayer;
      setEditingActive(true);
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
        statusDiv.innerText = t('placementFailed', error.message);
      }
    });
  }).catch((error) => {
    console.error('WME Area Manager: no se pudo registrar la pestaña del panel.', error);
  });
}
