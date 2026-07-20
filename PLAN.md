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

## Fase 2 — Modo polígono libre

- Selector de forma en el panel ("Rectángulo" / "Polígono"); el desplegable de aspect ratio solo aplica al rectángulo.
- Trazado con el método nativo `Map.drawPolygon()` del SDK: clic para añadir vértices, clic sobre el punto inicial para cerrar. Sin eventos de ratón propios para esta interacción.
- Capa propia `PolygonLayer` (`src/polygon-layer.js`): dibuja el contorno y un marcador por vértice.
- Cálculo de área geodésica del polígono con Turf.js (`polygonAreaKm2`, `src/geometry.js`) y comparación con el área máxima del nivel del editor (`getConfigForRank`, `src/config.js`): el panel indica si el área cumple el límite (contorno en verde/rojo).
- Borrado de vértices sueltos con clic izquierdo sobre su marcador (`wme-layer-feature-clicked` + `Events.trackLayerEvents`); no se permite bajar de 3 vértices.
- Enlace al centro aproximado del polígono, reutilizando `buildEditorLink` (`src/link.js`).

**Criterio de salida**: desde el panel se puede trazar un polígono de forma libre, ver si su área cumple el nivel del usuario, borrar vértices sueltos y obtener su enlace.

## Fase 3 — Persistencia y guardado con nombre (hecho)

- Wrapper de `GM_setValue`/`GM_getValue` (`src/storage.js`) sobre la estructura `{ id, nombre, lat, lon, nivel, zoom, area_km2, env, fechaCreacion, geometry }`, donde `geometry` es el `GeoJSON.Polygon` trazado (rectángulo o polígono libre), no reconstruido a partir de nivel/lat/lon — necesario para reproducir polígonos libres y para la exportación.
- Campo de nombre + botón "Guardar" en el panel.
- Validación: nombre obligatorio para guardar.
- Funciones de exportación (`src/geometry.js`): `toGeoJSONFeature(entry)` (envuelve `geometry` en un `Feature` con las propiedades del guardado) y `toWKT(polygon)` (conversión manual a texto `POLYGON(...)`, sin dependencia nueva). La Fase 3 deja estas funciones listas; el botón "Exportar" del panel (Fase 4, ver requisitos punto 7) las consume.

**Criterio de salida**: un rectángulo o polígono guardado sobrevive a recargar la página con su forma exacta, y puede exportarse a GeoJSON o WKT.

## Fase 4 — Gestión desde el panel (hecho)

- Listado de guardados (`loadRectangles()`, `src/storage.js`): nombre, nivel, fecha, por entrada.
- Capa nueva y mínima de solo lectura `SavedShapeLayer` (`src/saved-shape-layer.js`): dibuja `entry.geometry` tal cual (un único estilo de contorno, sin marcadores de vértice ni coloreado de validez ni manejadores de clic) — para repasar una figura guardada sin arrastrar el comportamiento de edición de `PolygonLayer` (borrado de vértice al clicar, color verde/rojo).
- Acciones por entrada:
  - **Cargar/centrar**: dibuja `entry.geometry` en `SavedShapeLayer` y centra la vista con `centerMapOnGeometry(geometry)` (bbox calculado directamente de las coordenadas — min/max manual, sin Turf — en vez de reconstruir un rectángulo desde `lat`/`lon`/`nivel`, ya que la fuente de verdad es la geometría exacta guardada en la Fase 3).
  - **Editar**: pasa la figura mostrada (recién colocada o cargada desde la lista) a `PolygonLayer` — el mismo modo de edición de la Fase 2 (marcadores de vértice, borrado por clic, contorno verde/rojo según el límite del nivel actual) — y la deja como `currentEntry` activo para poder arrastrarla (Fase 5) o volver a guardarla (sobrescribe por `id`).
  - **Exportar**: por entrada, GeoJSON o WKT vía `toGeoJSONFeature(entry)` / `toWKT(entry.geometry)` (`src/geometry.js`, ya listas de la Fase 3); el resultado se vuelca en un campo de texto de solo lectura, igual que el enlace.
  - **Copiar enlace**: `buildEditorLink({ lat: entry.lat, lon: entry.lon, zoom: entry.zoom, env: entry.env })`.
  - **Renombrar**: `renameRectangle(id, nombre)` (ya en `storage.js`).
  - **Eliminar**: `deleteRectangle(id)` (ya en `storage.js`) + quitar del mapa si es la entrada actualmente mostrada.
- Botón de limpieza del dibujo activo (`clear()` de la capa activa, `SavedShapeLayer` o `PolygonLayer` según el modo), independiente de la lista de guardados.

**Criterio de salida**: gestión completa (crear, listar, cargar, editar, exportar, renombrar, borrar) sin recargar la página.

## Fase 5 — Arrastre manual (hecho)

- El arrastre vive dentro del modo edición (`PolygonLayer`, ver Fase 4 "Editar"), no en la vista de solo lectura (`SavedShapeLayer`): solo tiene sentido reposicionar una figura que ya se puede tocar vértice a vértice.
- Desde la Fase 3, lo guardado/exportado es la geometría exacta trazada, así que el arrastre ya no recalcula un rectángulo nuevo "manteniendo el área fija" (`buildRectangleFromCenter`) — eso solo vale para el caso rectángulo perfecto y rompería un polígono libre editado a mano. En su lugar: **traslación rígida** de todos los vértices por el mismo delta (Δlon, Δlat) del ratón, válida por igual para rectángulo y polígono libre, preservando exactamente la forma exportable.
- Eventos de ratón (`wme-map-mouse-down/move`) sobre `PolygonLayer`: **clic para coger, clic para soltar**, no pulsar-mantener-soltar. El SDK público no expone forma de desactivar el paneo nativo del mapa (que escucha el mismo gesto físico de ratón), así que mantener el botón pulsado mientras se mueve el ratón dispara a la vez el paneo del mapa. Un clic simple (pulsar y soltar sin movimiento) no lo activa — el mismo motivo por el que `drawPolygon()` no panea al añadir vértices con clics. Por eso: un primer clic dentro del contorno (no sobre un marcador de vértice, reservado para borrar) arma el arrastre; cada `wme-map-mouse-move` (botón ya no pulsado) traslada `coordinates` desde la base fijada al armar y redibuja (`_redraw()`); un segundo clic en cualquier punto lo suelta, recalcula el centro aproximado (`polygonCenter`) y actualiza `currentEntry`.
- Si la figura arrastrada corresponde a un guardado existente (tiene `id`), "Guardar" sobrescribe esa entrada (ya soportado por `saveRectangle`, upsert por `id`).

**Criterio de salida**: arrastre fluido de cualquier forma (rectángulo o polígono) en modo edición, sin tocar el `DataModel` de WME, preservando la geometría exacta para guardado/exportación.

## Fase 6 — Edición de puntos

- Tres features por polígono en `PolygonLayer` (`_redraw()`), apiladas en este orden para que el propio hit-testing del SDK (no matemática propia) decida qué se ha clicado: `'fill'` (relleno semitransparente de todo el interior, verde/rojo según validez, `fillOpacity: 0.15`), `'outline'` (solo trazo, sin relleno) encima, y los marcadores `vertex-*` encima de ambas. Como el trazo queda por encima del relleno, un clic cerca del borde siempre resuelve a `'outline'`; un clic en el interior, lejos del trazo, resuelve a `'fill'`.
- Añadir vértices: clic sobre `'outline'` inserta un vértice nuevo en la arista más cercana (`nearestEdgeIndex`, `src/geometry.js`), usando la última posición conocida del ratón (`wme-map-mouse-move`), ya que el evento de clic sobre una feature no lleva coordenadas.
- Arrastrar la figura completa: clic sobre `'fill'` (el relleno interior, visualmente distinguible como zona clicable) arma el arrastre — sustituye al test geométrico propio (`pointInRing`, eliminado) usado en la Fase 5; el resto del comportamiento (traslación rígida, clic-clic) no cambia.
- Mover un vértice: un clic sobre su marcador arma su arrastre (mismo modelo clic-clic, ahora también por vértice individual); cada `wme-map-mouse-move` sigue el cursor directamente (sin traslación rígida, es un único punto); un segundo clic lo suelta.
- Borrado de vértices: sustituye el clic izquierdo de la Fase 2 por el mismo convenio del editor nativo de WME para geometrías — situarse sobre el marcador (`wme-layer-feature-mouse-enter`/`-leave`) y pulsar la tecla configurada (`Shortcuts.createShortcut` del SDK; no existe evento `keydown` nativo). Mantiene la regla de mínimo 3 vértices.
- Todas las acciones (añadir, mover, borrar) recalculan el contorno y llaman a `onChange`, igual que ya hacía el borrado, por lo que `sidebar.js` no necesita cambios.
- Solo aplica al modo edición de polígono (`PolygonLayer`); no toca `RectangleLayer` ni `SavedShapeLayer`.

**Criterio de salida**: desde el modo edición se puede añadir un vértice clicando sobre el borde, arrastrar la figura completa clicando en su interior relleno, reposicionar un vértice arrastrándolo y borrarlo pasando el ratón por encima y pulsando la tecla configurada — cada gesto resuelve siempre a la misma acción, sin ambigüedad entre borde e interior.

## Fase 7 — Traducciones (i18n) (hecho)

- Módulo nuevo `src/i18n.js`: diccionario de textos por idioma y función `t(clave)` que devuelve el texto del idioma activo; empieza con `es` como único idioma, con las claves extraídas literalmente de los textos ya existentes en `src/sidebar.js` y `src/link.js`.
- Detección de idioma: `sdk.Settings.getLocale()` (idioma activo de la interfaz de WME) como fuente, no `navigator.language`, con `es` como idioma por defecto si el SDK no lo expone o no hay traducción disponible para ese idioma. `initI18n(sdk)` se llama en `src/index.js` justo tras crear el `sdk`, antes de construir el panel (`initSidebar()`).
- Migración de los literales hardcodeados en `src/sidebar.js` (labels del selector de forma, placeholder de nombre, texto de botones, mensajes de estado) para que consuman `t('clave')` en vez de la cadena directa.
- El objetivo de la fase es dejar la infraestructura lista (diccionario + función `t()` + un único idioma migrado), no traducir a un segundo idioma todavía — eso queda fuera de alcance de esta fase.

## Fase 8 — Pulido y validación (hecho)

- Detección fiable de `env` para el enlace (con `row` por defecto).
- Confirmar mapeo real `rank` ↔ niveles 1-5 con cuentas de distinto nivel.
- Manejo de errores de la API SDK (capas inexistentes, guardado corrupto en `GM_getValue`, etc.).
- Texto de instrucciones en el panel: bloque breve en el sidebar (`src/sidebar.js`, junto a los controles de modo polígono) que explique el modelo de edición de la Fase 6 — clic en el borde añade un punto, clic en el interior (relleno) arrastra la figura, clic en un vértice lo arrastra, hover sobre un vértice + tecla configurada lo borra.
- Configuración del atajo de borrado desde el panel: control en el sidebar para elegir/cambiar la tecla del atajo de borrado de vértices (hoy fija en `PolygonLayer`), persistido igual que el resto de preferencias (`GM_setValue`/`GM_getValue`, `src/storage.js`) y re-registrado con `Shortcuts.deleteShortcut` + `Shortcuts.createShortcut` al cambiar.

**Criterio de salida**: todos los textos visibles del panel se sirven a través de `t()` desde un diccionario centralizado en `src/i18n.js`, con español como idioma por defecto y sin cambio de comportamiento visible respecto a hoy.

## Fase 9 — Interfaz (hecho)

- Diseño del panel (`src/sidebar.js`): separa los controles en dos bloques visuales con encabezado — "Figura actual" (selector de forma/aspecto, botón de colocar, estado, enlace, nombre, guardar, limpiar, exportación) y "Guardadas" (la lista). Un único `<style>` inyectado en el propio `tabPane` aporta el aspecto (borde, padding, espaciado), sin hoja de estilos externa ni dependencia nueva.
- Iconos con Font Awesome (`fa fa-save`, `fa fa-edit`, `fa fa-trash`, `fa fa-tag`, `fa fa-link`), sin dependencia nueva: WME ya sirve Font Awesome en la propia página del editor (de ahí que exista un userscript de terceros dedicado solo a corregir iconos de otros scripts cuando WME cambia de versión de FA), así que un `<i class="fa fa-...">` junto al texto ya existente del botón basta — en guardar, y por entrada de la lista en editar, eliminar, renombrar y copiar enlace.
- Abreviación del nivel en la lista de guardados (`buildEntryRow`, `src/sidebar.js`): "N4" en vez de "nivel 4"; el mensaje de estado de validación de área conserva su redacción actual ("dentro del límite del nivel X").
- Vértice armado para arrastre (`src/polygon-layer.js`): nueva propiedad `dragging` por vértice en `_redraw()` y regla de estilo adicional (color distinto) para el vértice con `pointIndex === vertexDragIndex`; `_redraw()` se invoca también al armar el arrastre y en ambos puntos de suelta (clic sobre marcador y clic que falla toda feature) para que el cambio de color sea inmediato.

**Criterio de salida**: el panel muestra visualmente separadas la figura en edición y la lista de guardados, con iconos en guardar/editar/eliminar/ renombrar/copiar enlace y el nivel abreviado ("N4"); al armar el arrastre de un vértice, éste cambia de color hasta soltarlo.

## Fase 10 — Empaquetado (hecho)

- Build final del `.user.js` con cabecera de metadatos completa (`@match`, `@grant`, `@version`, `@updateURL`/`@downloadURL` si se aloja para autoupdate).
- `dist/wme-area-manager.user.js` deja de estar en `.gitignore` y queda versionado en el repo: es el archivo que sirve la URL raw para Greasyfork y para el autoupdate de Tampermonkey.
- `@updateURL`/`@downloadURL` en `src/header.js` apuntando a la URL raw del mirror GitHub del proyecto: `https://raw.githubusercontent.com/satienza/wme-area-manager-polygons/main/dist/wme-area-manager.user.js`.
- Fuente única de verdad para la versión: `package.json`; el build (`build.js`) la vuelca en la cabecera al compilar, en vez de mantenerla duplicada a mano en `header.js`.
- El commit del build en cada release se automatiza con el hook de ciclo de vida `version` de `npm version` (sube la versión, corre el build y añade `dist/` al mismo commit/tag), sin paso manual ni script de release aparte.
- Webhook de Greasyfork para autoactualización de la ficha al hacer push: Greasyfork solo soporta GitHub, GitLab o Bitbucket como origen del webhook, y el desarrollo vive en Forgejo autoalojado (`forgejo.petricor.net`), así que se usa como puente el mirror `https://github.com/satienza/wme-area-manager-polygons` (rama `main`). Pasos operativos (fuera del repo): push-mirror de Forgejo hacia ese repo GitHub; en la ficha de Greasyfork (pestaña Admin) fijar la sync URL a la URL raw de arriba; en el repo GitHub añadir el webhook `https://greasyfork.org/en/users/1062697-freakyman/webhook` (content type `application/json`, disparado en eventos push).
- Changelog inicial.
