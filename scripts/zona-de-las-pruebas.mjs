/**
 * **Las pruebas de este repo corren en UTC, siempre.**
 *
 * Una sola línea, importada por cada `vitest*.config.ts`, para que no haya una
 * forma de correr la suite sin ella.
 *
 * ## Por qué existe este archivo
 *
 * La zona vivía **sólo en los scripts** (`"test": "TZ=UTC vitest run"`). Quien
 * corriera `vitest` desde el editor, desde `npx` —para filtrar un archivo o una
 * prueba— o desde un workflow nuevo, la perdía. Y perderla no da un error: da
 * un **rojo que parece un fallo del producto**.
 *
 * Pasó el 23 de septiembre de 2026:
 * `integration.test.ts > generateForProfile — alineación de calendario` se puso
 * roja con `npx vitest run`, y yo lo reporté en un PR como un fallo de `main`.
 * No lo era. El diagnóstico completo está en
 * `docs/Diagnostico-Rango-Del-Generador-2026-09-23.md`.
 *
 * ## Por qué UTC y no la zona de Juárez
 *
 * Porque **es la zona en la que corre el producto**: los crons y las rutas
 * viven en Vercel, que corre en UTC. Una suite que corriera en
 * `America/Ciudad_Juarez` mediría una máquina que no existe en producción, y
 * dejaría pasar justo los defectos que la zona destapa.
 *
 * Lo que **no** hace esto: quitar la dependencia del generador de ocurrencias
 * respecto de la zona de la máquina. Ésa era la opción (b) del diagnóstico y
 * **ya está cerrada**: el rango viaja en fechas civiles y ni `setHours` ni
 * `toISOString` deciden un día. Esto sigue haciendo falta por lo suyo —que la
 * suite mida la zona en la que corre el producto— y porque la prueba que
 * destapa la trampa mueve la zona a propósito **desde dentro**, y necesita
 * saber a cuál volver.
 *
 * ## Por qué asignar `process.env.TZ` funciona
 *
 * Desde Node 16, escribir `process.env.TZ` le avisa al motor de fechas y el
 * cambio surte efecto en las fechas que se creen después. Se hace **al cargar
 * la configuración**, antes de que exista el primer `Date` de una prueba.
 */
process.env.TZ = "UTC";

/** La zona en la que corre el producto, y por lo tanto la suite. */
export const ZONA_DE_LAS_PRUEBAS = "UTC";
