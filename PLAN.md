# Plan de desarrollo — WME Area Manager

Requisitos y viabilidad completos en [`requisitos_wme_area_manager.md`](./requisitos_wme_area_manager.md). Este plan los desglosa en fases ejecutables.

## Fase 0 — Andamiaje (hecho)

- Estructura de carpetas, `package.json`, build con esbuild, cabecera de metadatos del userscript, README.

## Fase 1 — Prototipo mínimo

- Inicialización del SDK con `unsafeWindow.SDK_INITIALIZED` (`src/index.js`).
- Pestaña en el panel lateral (`Sidebar.registerScriptTab`).
- Modo colocación: clic en el mapa (`Map.drawPoint()`) define el centro.
- Lectura del `rank` del editor (`State.userInfo`) y mapeo a nivel/zoom/área (`src/config.js`).
- Cálculo del cuadrado geodésico con Turf.js (`src/geometry.js`).
- Dibujo del rectángulo en capa propia (`Map.addLayer` + `addFeatureToLayer`) (`src/map-layer.js`).
- Generación del enlace al centro (`src/link.js`).

**Criterio de salida**: desde el panel se puede colocar un rectángulo del tamaño correcto según el rank del usuario y obtener su enlace.

## Fase 2 — Persistencia y guardado con nombre

- Wrapper de `GM_setValue`/`GM_getValue` (`src/storage.js`) sobre la estructura `{ id, nombre, lat, lon, nivel, zoom, area_km2, env, fechaCreacion }`.
- Campo de nombre + botón "Guardar" en el panel.
- Validación: nombre obligatorio para guardar.

**Criterio de salida**: un rectángulo guardado sobrevive a recargar la página.

## Fase 3 — Gestión desde el panel

- Listado de guardados (nombre, nivel, fecha) en el sidebar.
- Acciones por entrada: cargar/centrar (`centerMapOnGeometry`), copiar enlace, renombrar, eliminar.
- Botón de limpieza del dibujo activo, independiente de la lista de guardados.

**Criterio de salida**: gestión completa (crear, listar, cargar, renombrar, borrar) sin recargar la página.

## Fase 4 — Arrastre manual

- Eventos de ratón (`wme-map-mouse-down/move/up`) sobre la capa propia para arrastrar el rectángulo manteniendo el área fija.
- Redibujado en cada movimiento (`removeFeatureFromLayer` + `addFeatureToLayer` o `redrawLayer`).
- Si el rectángulo arrastrado está guardado, permitir sobrescribir su posición.

**Criterio de salida**: arrastre fluido sin tocar el `DataModel` de WME ni generar cambios sin guardar.

## Fase 5 — Pulido y validación

- Detección fiable de `env` para el enlace (con `row` por defecto).
- Confirmar mapeo real `rank` ↔ niveles 1-5 con cuentas de distinto nivel.
- Manejo de errores de la API SDK (capas inexistentes, guardado corrupto en `GM_getValue`, etc.).

## Fase 6 — Empaquetado

- Build final del `.user.js` con cabecera de metadatos completa (`@match`, `@grant`, `@version`, `@updateURL`/`@downloadURL` si se aloja para autoupdate).
- Changelog inicial.
