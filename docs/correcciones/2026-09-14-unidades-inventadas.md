# Unidades inventadas: soltar seis FTC927 y borrar sus unidades — 14 de septiembre de 2026

Acompaña a dos archivos que se pegan **por separado** en la consola de Neon, en
este orden:

1. [`2026-09-14-unidades-inventadas-paso-1-soltar.sql`](./2026-09-14-unidades-inventadas-paso-1-soltar.sql): cierra las asignaciones. Reversible.
2. [`2026-09-14-unidades-inventadas-paso-2-borrar.sql`](./2026-09-14-unidades-inventadas-paso-2-borrar.sql): borra las unidades. **Irreversible.**

## Qué se corrige

Al dar de alta los FTC927 nuevos, la pantalla de flota pide
«1) registra la unidad → 2) registra el GPS → 3) asígnalos», y se siguió al pie
de la letra con aparatos que todavía no están en ningún vehículo. Quedaron seis
unidades que no son vehículos, cinco de ellas con el nombre del aparato:

| Cuenta | Unidad inventada | GPS que trae | Puntos atribuidos |
|---|---|---|---|
| Juárez Bus | PRUEBA-ESCRITORIO | FTC927 (Prueba), futuro TK-FTC927-008 | 0 |
| ASAV | Ejemplo para: TK-FTC927-002 | TK-FTC927-003 | 12 |
| ASAV | TK-FTC927-003 | TK-FTC927-004 | 2 |
| ASAV | TK-FTC927-005 | TK-FTC927-005 | 0 |
| ASAV | TK-FTC927-005 (otra unidad, mismo nombre) | TK-FTC927-006 | 0 |
| ASAV | TK-FTC927-007 | TK-FTC927-007 | 0 |

El Jeep de ASAV, con TK-FTC927-002, es un vehículo real y **no se toca**.

La plataforma no tiene cómo deshacer esto: la API de unidades solo crea, no hay
borrar ni renombrar, y un GPS no se puede dejar sin unidad (el paso 3 solo lo
mueve de una a otra). Por eso va como corrección.

## La regla, y por qué se borran en vez de renombrarse

> Los aparatos van sin unidad hasta instalarse en un vehículo real. La regla es
> igual para todos. Una unidad nombrada con el aparato que trae miente el día
> que el aparato cambie, y además ésas no son vehículos.
>
> — Asav, 14 de septiembre de 2026

Renombrarlas dejaría seis vehículos falsos en la flota. Soltarlas sin borrarlas
dejaría los 14 puntos diciendo que los recorrió «Ejemplo para: TK-FTC927-002».

## Los 14 puntos que quedan sin unidad son lo correcto

Borrar una unidad deja en `NULL` el `unit_id` de sus `telemetry_points`. Aquí es
exactamente lo buscado:

> El aparato sí estuvo ahí, la unidad nunca existió.
>
> — Asav, 14 de septiembre de 2026

Los puntos **no se pierden**: conservan su `imei` y su `device_id`, porque los
aparatos no se borran. Es lo contrario de la baja de aparatos del #400, donde
borrar el aparato habría reescrito historia real; aquí lo que se borra nunca
existió.

## Las guardas, y por qué van dentro del `WHERE`

Entre escribir esto y pegarlo pueden pasar horas, y alguien puede usar la
pantalla de flota mientras tanto.

**Paso 1** solo cierra una asignación si la unidad conserva **el mismo id, el
mismo nombre, la misma cuenta y el mismo IMEI puesto**.

**Paso 2** solo borra una unidad si:

- conserva el mismo id, nombre y cuenta;
- tuvo **exactamente una** asignación en su vida y **ya está cerrada**. Si el
  paso 1 no corrió, el paso 2 no borra nada; si alguien le asignó otro aparato
  mientras tanto, esa unidad no se borra;
- **nada más la nombra**: perfiles de servicio, ocurrencias, puntos de evidencia,
  hechos, circuitos, aportaciones, verdad de campo, mediciones de recorrido,
  combustible, mantenimiento, posición en vivo. La telemetría es la única
  dependencia permitida, y se cuenta antes de borrar.

## Cómo se leen las verificaciones

| Paso | Número | Esperado | Si falla |
|---|---|---|---|
| 1 | `soltadas` | 6 | menos = una guarda bloqueó (cambió nombre, cuenta o aparato) |
| 1 | `abiertas_en_inventadas` | 0 | quedó una asignación abierta en una inventada |
| 1 | `jeep_con_su_gps` | 1 | **se tocó el Jeep**: ROLLBACK de inmediato |
| 2 | `puntos_que_quedan_sin_unidad` | 14 | más = el archivador atribuyó puntos entre paso y paso; revisar antes de seguir |
| 2 | `borradas` | 6 | menos = alguna guarda bloqueó; ver cuál antes de reintentar |
| 2 | `inventadas_que_quedan` | 0 | |
| 2 | `jeep` | 1 | **se tocó el Jeep**: ROLLBACK de inmediato |

`inventadas_que_quedan = 0` **por sí solo no prueba nada**: daría 0 también si
los ids no casaran con ninguna unidad. Hay que mirarlo junto con `borradas = 6`.

## Ensayo

Corrido el 14 de septiembre de 2026 en la base desechable (`DATABASE_URL_TEST`),
con el escenario sembrado (las dos cuentas, las siete unidades con sus ids, los
aparatos, las asignaciones y los 22 puntos: 8 del Jeep, 12 y 2) dentro de una
transacción que se revirtió al terminar:

| Orden | Resultado |
|---|---|
| Paso 2 **antes** del paso 1 | 14 · **borradas 0** · quedan 6 · jeep 1: la guarda de «asignación cerrada» detuvo todo |
| Paso 1 | soltadas 6 · abiertas 0 · jeep 1 |
| Paso 2 | 14 · borradas 6 · quedan 0 · jeep 1 |
| Después | 14 puntos sin unidad · los 8 del Jeep con su unidad · los 7 aparatos siguen |

Los ids, nombres, cuentas, IMEI y conteos se leyeron de producción con
`DATABASE_URL_READONLY` el mismo día, a las 18:49 hora de Juárez.

## Lo que esto NO hace

- **No da de baja ningún aparato.** Los siete FTC927 siguen activos, en su cuenta
  y sin unidad hasta que se instalen en un vehículo.
- **No renombra «FTC927 (Prueba)» a TK-FTC927-008.** Queda pendiente aparte.
- **No resuelve que la pantalla invite a crear la unidad primero.** Mientras el
  orden diga «1) registra la unidad», esto va a volver a pasar.
