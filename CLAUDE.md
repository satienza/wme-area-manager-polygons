# WME Area Manager

## Idioma

- Comentarios en el código y el README: **en inglés**.
- Plan (`PLAN.md`, archivado) y requisitos (`requisitos_wme_area_manager.md`): **en español**.
- Keywords en issues y PR: **en inglés**.
- Descripción de versiones y tags: **en inglés**.

## Forgejo

- token para el repositorio se encuentra en `.env`.

## Flujo de trabajo

- `PLAN.md` está cerrado/archivado: constancia histórica de las fases 0-11, no se edita para añadir trabajo nuevo.
- El trabajo nuevo (features, bugs) se gestiona con issues y pull requests en Forgejo (`forgejo.petricor.net/satienza/wme-area-manager`).

### Inicio de sesión

- Si el usuario no indica ya un issue o rama de trabajo al iniciar la sesión, preguntar si quiere crear un issue nuevo antes de continuar.
- El trabajo normalmente arranca en modo "plan". Si se detecta que el pedido implica cambios de código y la sesión no está en modo plan, preguntar si se quiere cambiar a modo plan antes de tocar código.

### Issue y rama

- Trabajar en un issue nuevo implica crear una rama nueva.
- Convención de nombres de rama: `{tipo}-{número}-{slug}`, con el prefijo según el tipo de issue en Forgejo (`fix-` para bugs, `feature-` para funcionalidades nuevas, `chore-` para tareas). Ejemplos: `fix-6-nuevo-item-sidebar`, `fix-4-arrastre-area`.

### Implementación y prueba

- Una vez aceptado el plan y hechos los cambios, correr `npm test` (self-check) y compilar el proyecto (`npm run build`) para que el usuario lo pruebe en el editor.
- Preguntar si el funcionamiento es correcto o hay que corregir algo.
  - Si hay que corregir algo: al terminar la corrección, recompilar y repetir la pregunta.
  - Si es correcto: valorar los cambios realizados y si es necesario un nuevo número de versión (cambios menores, relacionados con otro issue que queda por resolver, etc...).
    - Si se considera que es necesario una nueva versión, sugerir el número de versión (`package.json` + entrada en `CHANGELOG.md`), mostrarlo y esperar confirmación — no incrementar la versión por defecto sin confirmación.
      - Una vez el usuario la confirme, revisar que la documentación (`README.md`, etc.) siga reflejando el estado real del proyecto (versión, funcionalidades, estructura de ficheros) y actualizarla si hace falta.
    - Si se decide no incrementar la versión revisar que la documentación (`README.md`, etc.) siga reflejando el estado real del proyecto (funcionalidades, estructura de ficheros) y actualizarla si hace falta.

### Commit, PR y release

- Con la versión confirmada, preparar el commit, mostrarlo y esperar confirmación.
- Confirmado el commit: crearlo y abrir el pull request. El merge del PR se confirma por separado, no es automático.
- Al mergear un PR que incrementó la versión, crear la release correspondiente en Forgejo (tag + notas tomadas de la entrada de `CHANGELOG.md`).
- La descripción de las releases y los tags no debe contener keywords de issues, sólo la descripción de las novedades.
- Tras el merge, borrar la rama del issue (local y remota).
