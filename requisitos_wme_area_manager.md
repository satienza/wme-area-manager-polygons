# Requisitos y viabilidad — Script WME Area Manager

## 1. Objetivo

Userscript (Tampermonkey) para el Waze Map Editor (WME) que traza un rectángulo centrado en un punto elegido por el editor, con área/zoom fijados según su nivel de editor, y genera un enlace directo al punto central.

## 2. Requisitos funcionales

1. **Activación**: botón/pestaña en el panel lateral de WME (`Sidebar.registerScriptTab`). Al pulsarlo se entra en "modo colocación".
2. **Colocación del centro**: en modo colocación, el usuario hace clic en el mapa; ese punto es el centro del rectángulo (`Map.drawPoint()`).
3. **Nivel de editor**: se obtiene automáticamente del `rank` expuesto por la sesión de usuario del SDK (`State.userInfo` → `rank`, `isAreaManager`, `isCountryManager`). Sin selección manual.
4. **Regla nivel → zoom/área**:
   | Nivel | Zoom | Área | Lado del cuadrado (aprox.) |
   |---|---|---|---|
   | 1, 2 | 15 | 7,59 km² | 2,76 km |
   | 3 | 14 | 30,37 km² | 5,51 km |
   | 4, 5 | 13 | 121,5 km² | 11,02 km |

   (El área se duplica en lado por cada nivel de zoom, consistente con el escalado estándar de tiles Web Mercator — sirve de comprobación de que la tabla es coherente.)
5. **Trazado**: rectángulo (cuadrado) dibujado en una capa propia (`Map.addLayer` + `addFeatureToLayer`), centrado en el punto y con el área correspondiente al nivel.
5.1. **Modo polígono libre**: el panel ofrece un selector de forma ("Rectángulo" / "Polígono"). En modo polígono, el usuario hace clic tantas veces como necesite para añadir vértices y cierra el trazado pulsando sobre el punto inicial, usando el método nativo `Map.drawPolygon()` del SDK (no se reimplementa la interacción de dibujo a mano).
   - **Validez por nivel**: el panel y el propio contorno del polígono (color verde/rojo) indican si el área trazada cumple el nivel del editor. Para una forma libre, "cumplir" significa que el área geodésica (Turf.js, `turf.area`) es **menor o igual** al área máxima de la tabla del punto 4 (no una coincidencia exacta, que no aplica a una forma arbitraria).
   - **Borrado de vértices**: un clic izquierdo sobre el marcador de un vértice lo elimina y redibuja el polígono. No se permite bajar de 3 vértices. Se descarta el borrado por clic derecho: el SDK no expone qué botón del ratón se pulsó (`SdkMouseEvent` no tiene campo `button`) ni ofrece un evento de clic derecho sobre features; enganchar `contextmenu` del DOM del mapa por fuera de la API pública sería frágil y no está documentado.
   - Reutiliza el enlace al centro (punto 9) sobre un centro aproximado (media de los vértices) del polígono.
6. **Guardado con nombre**: tras trazar el polígono (de ahora en adelante), un campo de texto ("Nombre") y un botón "Guardar" lo añaden a una lista persistente. El nombre es obligatorio para guardar; no se guarda automáticamente al dibujar. El nombre se autorrellena con "Polygon aaaammddhhmmss". 
7. **Gestión desde el panel**: el panel lateral muestra la lista de rectángulos guardados (nombre, nivel, fecha de creación). Por cada entrada:
   - **Cargar/centrar**: vuelve a dibujar el rectángulo en el mapa y centra la vista sobre él (`centerMapOnGeometry`).
   - **Exportar**: exportar el polígono (rectángulo o polígono libre) en formato WKT (`https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry`)
   - **Copiar enlace**: copia el enlace al punto central (ver punto 9).
   - **Renombrar**: edita el nombre sin recalcular geometría.
   - **Eliminar**: borra la entrada de la lista y, si está dibujado, lo quita del mapa.
8. **Reposicionable**: permitir arrastrar el rectángulo para reubicarlo manteniendo el área fija. Si un rectángulo guardado se arrastra, su nueva posición debe poder volver a guardarse (sobrescribiendo lat/lon de la entrada). Implementación: capa propia + arrastre manual (ver detalle técnico en sección 3). Se descarta la alternativa de usar un Venue temporal del modelo de datos por el riesgo de que acabe guardado como Place real en el mapa.
9. **Enlace al centro**: en el caso del rectángulo generar y mostrar/copiar un enlace con formato:
   `https://waze.com/editor?env=row&lat={lat}&lon={lon}&marker=true&zoomLevel={zoom}`
   - `env` debe derivarse del entorno actual (leer de `window.location`/región del editor), con `row` como valor por defecto.
   - `lat`/`lon` con precisión suficiente (5 decimales, igual que el ejemplo).
10. **Limpieza del dibujo actual**: opción para borrar el rectángulo activo del mapa sin tocar la lista de guardados (`removeAllFeaturesFromLayer`), independiente de "Eliminar" (punto 7), que sí afecta a la lista.

## 3. Requisitos técnicos (WME SDK)

- Inicialización con `unsafeWindow.SDK_INITIALIZED` + `getWmeSdk` (obligatorio por el uso de `GM_setValue`/`GM_getValue`, ver más abajo).
- Módulos usados: `State` (rank de usuario), `Map` (`drawPoint`, `drawPolygon`, `addLayer`, `addFeatureToLayer`, `removeFeatureFromLayer`, `getMapCenter`, `getZoomLevel`), `Sidebar` (panel de control), `Events` (`wme-ready`, `wme-layer-feature-clicked` vía `trackLayerEvents` para el borrado de vértices del polígono, eventos de ratón si se implementa el arrastre).
- **Cálculo geodésico del cuadrado**: no usar deltas fijos de grados (la distorsión de Mercator varía con la latitud). Usar una librería como **Turf.js** (`turf.destination` / `turf.bbox`) para construir el cuadrado con el área real en km² correcta en cualquier latitud, tal como recomienda la propia documentación del SDK para geometrías complejas.
- Sin llamadas a `Editing.save()`: el rectángulo es solo una ayuda visual/de enlace, no se guarda como objeto del mapa de Waze.
- **Persistencia de los guardados**: `GM_setValue`/`GM_getValue` (almacenamiento propio de Tampermonkey, por script). Requiere declarar `@grant GM_setValue` y `@grant GM_getValue` en la cabecera.
  - **Importante**: en cuanto se usa cualquier `@grant` distinto de `none`, Tampermonkey aísla el `window` del script del `window` real de la página. Hay que añadir `@grant unsafeWindow` e inicializar con `unsafeWindow.SDK_INITIALIZED` en vez de `window.SDK_INITIALIZED`, o la inicialización del SDK falla (documentado en la propia guía de troubleshooting del SDK).
- **Estructura de datos por rectángulo guardado**:
  `{ id, nombre, lat, lon, nivel, zoom, area_km2, env, fechaCreacion }`
  Identificador `id` único (no el nombre) para permitir nombres duplicados y renombrados sin romper referencias.

### 3.1 Arrastre: capa propia + arrastre manual

- Rectángulo como feature en una capa creada vía `Map.addLayer`/`addFeatureToLayer`, sin tocar el `DataModel`. No se usa `DataModel.Venues.addVenue` ni `Editing.setSelection` (esta última requiere que el objeto exista en el modelo de datos de WME, lo que habría implicado crear un Venue/Place real — descartado).
- Arrastre implementado a mano con eventos de ratón (`wme-map-mouse-down/move/up`): al pulsar sobre el rectángulo se inicia el arrastre, en cada movimiento se recalcula el centro (manteniendo el área/lado fijos) y se redibuja la capa (`removeFeatureFromLayer` + `addFeatureToLayer` o `redrawLayer`), y al soltar se fija la nueva posición.
- No genera cambios sin guardar ni interactúa con `Editing.save()`: cero riesgo de contaminar el mapa real de Waze.

## 4. Requisitos no funcionales

- Sin dependencias pesadas; Turf.js puede incluirse vía CDN o bundling.
- Rendimiento: recalcular geometría solo en clic/arrastre, no en cada frame salvo durante el propio arrastre.
- Compatibilidad: WME SDK v2.354+ (versión documentada al momento de este análisis).

## 5. Supuestos y riesgos

- Se asume que `rank` del SDK coincide con los "niveles" 1-5 de la tabla; falta confirmar el mapeo exacto (el SDK expone `isAreaManager`/`isCountryManager` aparte del rank, y el rango de Waze en general va de 1 a 6 — verificar en pruebas con cuentas de distinto nivel).
- El arrastre (punto 8) se implementa siempre sobre la capa propia del script, con eventos de ratón; se descarta usar un Venue/Place real del `DataModel` para evitar cualquier riesgo de que el rectángulo acabe guardado en el mapa de Waze.
- El parámetro `env` del enlace depende de la región del editor; si no se puede leer de forma fiable, usar `row` por defecto y permitir que el usuario lo cambie.
- Se asume que no hace falta límite de rectángulos guardados; `GM_setValue` soporta el volumen esperado (decenas/cientos de entradas) sin problema.
- Se asume que los guardados son locales al navegador/perfil de Tampermonkey del editor (sin sincronización entre dispositivos); si se necesitara compartir entre editores, sería un alcance aparte (fuera de v1).

## 6. Viabilidad

**Viable.** Todos los requisitos funcionales principales (detectar rank, dibujar cuadrado geodésico centrado en un clic, mostrarlo en una capa, generar el enlace, botón en sidebar, guardado con nombre y gestión desde el panel) se apoyan en métodos documentados y estables del WME SDK. El arrastre se resuelve con lógica propia sobre una capa aislada del script (sin tocar el `DataModel`), que exige algo más de desarrollo pero elimina cualquier riesgo de guardar datos falsos en el mapa real.

## 7. Próximos pasos

1. Prototipo mínimo: sidebar + clic en mapa + cuadrado geodésico con Turf.js + enlace.
2. Confirmar mapeo rank del SDK ↔ niveles 1-5 con cuentas reales.
3. Implementar persistencia (`GM_setValue`/`GM_getValue`) y la lista de guardados con acciones (cargar, renombrar, eliminar).
4. Implementar el arrastre manual sobre la capa propia (eventos de ratón + recálculo de geometría).
5. Definir metadatos del userscript (`@match`, `@grant GM_setValue/GM_getValue/unsafeWindow`, versión SDK requerida).
