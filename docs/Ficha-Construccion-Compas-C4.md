# Ficha de construcción — Compás C4 · Dispositivos y sus acciones

Abierta el 17 de septiembre de 2026, con las decisiones que ASAV ratificó la
noche del 16. Entra al repo con C4-a.

**Qué es.** El cuarto «Dispositivos» del transportista (Marco 6.6) y las
acciones sobre un dispositivo desde la pantalla nueva: dar de alta, asignar,
soltar y dar de baja (6.18, 6.25). Reemplaza el alta vieja de
`/carrier/flota/alta`.

**Prototipo (por revisar, todavía NO aprobado):**
https://claude.ai/artifact/FGi58hto8teEYappBAQw1Z (v1). Sus ocho supuestos
están a la vista en su columna «Para decidir». Hasta que ASAV lo apruebe no se
escribe C4-b ni C4-c. Gobierna `.claude/skills/jtel-diseno/SKILL.md`; sobre
él, el Marco (Pieza 6 §A, §C y §E).

---

## Las decisiones ratificadas (16-sep-2026)

1. **El carrier captura el IMEI y el sistema genera el nombre** (6.3): marca +
   modelo + consecutivo global de toda la plataforma, que nunca se reutiliza
   ni se renumera.
2. **Asignar y soltar son sólo «ahora».** Poner otra hora cambia a qué unidad
   pertenece evidencia ya archivada (el archivador sella la unidad de cada
   punto al guardarlo); eso merece su propia conversación.
3. **Se guarda quién y por qué.** Quién abrió cada asignación, quién la cerró
   y por qué; quién dio cada baja.
4. **El IMEI único en toda la plataforma queda para después.** Mientras tanto
   el alta nueva busca el IMEI en todas las cuentas y se niega si ya existe,
   sin nombrar la otra cuenta: moverlo es cosa de J-Staff (6.14).
5. **Las acciones sólo las usan coordinador y admin** (`fleet.manage`).
   Provisional hasta la 6.29.

---

## Lo que ya existe y se reutiliza (no se reescribe)

- El inventario clasificado: `estadoDeDispositivo` y `clasificarFlota`
  (`@jtel/domain` flota.ts, #411) y `clasificarFlotaDeCuenta` en services.
- Ver ‹dispositivo› (#421), que hoy sólo lee.
- Los glifos de dispositivo (cuadros) en `components/casa/glifo.tsx`.
- La entrada «Dispositivos» del menú, con `ruta: null` en `lib/casa/casas.ts`.
- El dígito verificador del IMEI (#395); desde C4-a vive en `@jtel/domain`.

---

## Orden de PRs (una rama por PR, uno a la vez)

| PR | Qué | Quién mergea |
|---|---|---|
| **C4-a** | Migración 0039 (quién y motivo, los dos candados de asignación vigente, el consecutivo), el repositorio en transacción (`darDeAltaDispositivo`, `assignDevice`, `soltarDispositivo`, `darDeBajaDispositivo`), las reglas en `@jtel/domain` y las acciones con la cuenta de por medio en services. Sin pantalla. | **Asav**: trae migración. Primero la hoja `docs/correcciones/2026-09-17-aplicar-0039-acciones-de-dispositivo.sql` en Neon. |
| — | Prototipo aprobado. | Asav |
| **C4-b** | El cuarto Dispositivos: inventario por grupos, la entrada del menú y el alta. | Devin, tras revisión visual de Asav |
| **C4-c** | Las acciones en Ver ‹dispositivo›: rutas con `fleet.manage`, paneles de asignar, soltar y dar de baja, y la historia con quién y por qué. | **Asav**: la ruta es guardia. |
| **C4-d** | Apagar el alta vieja de `/carrier/flota/alta`, ya con los 7 FTC rodando. | Asav |

---

## Puntos de alto (modo «avanza y detente»)

- Antes de aplicar la 0039: el PASO 1 de la hoja da **0 y 0** duplicados y
  **8 FTC927 con número del 1 al 8**. Si no, se para.
- Antes de C4-b: prototipo aprobado.
- Al terminar C4-b y C4-c: capturas en las dos pieles, en celular y en
  computadora, junto al prototipo.

---

## Encontrado en el camino, sin arreglar todavía

**Ver ‹dispositivo› lista unidades de otras cuentas.**
`cargarExpedienteDeDispositivo` toma las unidades de
`asignacionesDeDispositivo(deviceId)`, que no filtra por cuenta. Un dispositivo
que cambió de cuenta (6.14; los FTC927 003–007 el 16 sep) mostraría a su cuenta
nueva el número económico y las fechas de las unidades de la cuenta anterior.
El enlace a esa unidad no abre (`unidadDeCuenta` sí filtra), pero el nombre ya
se vio. No se sabe si hoy pasa con datos reales: hace falta leer en producción
si esos cinco tuvieron asignaciones en ASAV. Se corrige antes de C4-c, que
agrega la historia con quién y por qué.

---

## Enmiendas al plan (`docs/jtel-plan-de-desarrollo.md`)

Ninguna todavía. El plan se actualiza al cerrar C4.
