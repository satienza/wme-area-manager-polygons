# wme-area-manager

Userscript de Tampermonkey para el Waze Map Editor (WME). Traza un rectángulo centrado en un punto del mapa, con área y zoom fijados según el nivel del editor, permite guardarlo con nombre y gestionar los guardados desde el panel lateral, y genera un enlace directo al punto central.

- Requisitos y análisis de viabilidad: [`requisitos_wme_area_manager.md`](./requisitos_wme_area_manager.md)
- Plan de desarrollo por fases: [`PLAN.md`](./PLAN.md)

## Estado

En andamiaje. Estructura y stubs de módulos creados (Fase 0 del plan); pendiente implementar la Fase 1 en adelante.

## Estructura

```
src/
  header.js     Cabecera de metadatos del userscript (@name, @match, @grant...)
  index.js      Punto de entrada, inicialización del SDK
  config.js     Regla nivel de editor -> zoom/área
  geometry.js   Cálculo geodésico del cuadrado (Turf.js)
  storage.js    Persistencia de guardados (GM_setValue/GM_getValue)
  map-layer.js  Capa propia del SDK: dibujo y arrastre manual
  link.js       Generación del enlace al punto central
  sidebar.js    Panel lateral (UI)
build.js        Bundle con esbuild -> dist/wme-area-manager.user.js
```

## Desarrollo

```bash
npm install
npm run build     # genera dist/wme-area-manager.user.js
npm run watch      # reconstruye en cada cambio
```

Para probarlo, instalar `dist/wme-area-manager.user.js` en Tampermonkey y abrir el WME.

## Dependencias pendientes

- `@turf/turf` para el cálculo geodésico del cuadrado (ver `src/geometry.js`).
