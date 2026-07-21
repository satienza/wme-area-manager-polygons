# WME Area Manager

## Idioma

- Comentarios en el código y el README: **en inglés**.
- Plan (`PLAN.md`, archivado) y requisitos (`requisitos_wme_area_manager.md`): **en español**.

## Flujo de trabajo

- `PLAN.md` está cerrado/archivado: constancia histórica de las fases 0-11, no se edita para añadir trabajo nuevo.
- El trabajo nuevo (features, bugs) se gestiona con issues y pull requests en Forgejo (`forgejo.petricor.net/satienza/wme-area-manager`).
- Al preparar el commit que cierra un issue, valorar si los cambios justifican incrementar la versión (`package.json` + entrada en `CHANGELOG.md`) y preguntar al usuario antes de aplicarlo — no incrementar la versión por defecto sin confirmación.
- Al mergear un PR que incrementó la versión, crear la release correspondiente en Forgejo (tag + notas tomadas de la entrada de `CHANGELOG.md`).
