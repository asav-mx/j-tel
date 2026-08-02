# Ficha de Diagnóstico — Veintiuna rutas esperan llegada en una geocerca llamada VOID

**Gobierna:** el `Marco-Limpio-J-Telemetry-MAESTRO.md` y la compuerta de salida de Ola 2 del `PLAN-v1.md`.
**Estado:** hallazgo verificado contra la base y contra el ledger del propio árbitro. **No se corrigió ni se borró nada.**
**Origen:** salió de investigar por qué 45 de 82 unidades no cubrieron ningún servicio en 30 días. Esa pregunta se respondió y no era esto — ver §6. Esto apareció de lado y es lo que sí es un defecto.

---

## 1. El hallazgo, en una frase

> **Veintiuna rutas del cliente contratado esperan la llegada en una geocerca llamada `VOID`, con rol `otro` en vez de `destino`, a ocho kilómetros del destino real.** Sobre ellas el árbitro sella 8.6% de cumplidos; sobre las rutas hermanas que apuntan al destino verdadero, 51.4%. Mismo cliente, mismo transportista, mismo umbral, mismo rigor, mismo periodo. **189 servicios futuros siguen apuntando ahí.**

---

## 2. Qué es VOID

| | |
|---|---|
| Nombre | `VOID` |
| `role` | **`otro`** (las demás de destino son `destino`) |
| `owner_type` | `plant` |
| Creada | 2026-07-07 19:55:34 — la primera geocerca de la base, en el mismo segundo que la de la cuenta de demostración |
| Centro | 31.69090, −106.42340 |
| Radio aproximado | 110 m |
| Distancia al destino real (`Campus`) | ~8 km |

El nombre no es una coincidencia desafortunada: es la palabra que se escribe cuando falta el dato. Y el `role` lo confirma — una geocerca de llegada se registra como `destino`; esta quedó como `otro`.

---

## 3. Qué rutas la usan

**Las veintiuna que tienen sufijo de variante, y solo esas.** Ninguna ruta base apunta a VOID; ninguna ruta con sufijo apunta a otro lado.

```
Centro - A · Colinas - A · Finca - A · Finca Auxiliar - A · Huertas - B ·
Juarez Nuevo - A · Juarez Nuevo - B · Km 20 - A · Km 30 - A · Km 30 - B ·
Oasis - A · Parajes del Sur - A · Riveras 7 - A · Riveras 9 - A · Riveras 9 - B ·
Safari - A · San Isidro - A · San Jose - B · San Jose Auxiliar - B ·
Sanders - A · Sierra Vista - A
```

Las 27 rutas base —`Finca`, `Oasis`, `Riveras 9`, `Sierra Vista`…— apuntan a `Campus`. La partición es limpia: **cuando se dieron de alta las variantes, el destino no se copió de la ruta madre.**

---

## 4. Lo que cuesta, medido

Ocurrencias pasadas del cliente contratado, 30 días al 2026-08-02:

| Geocerca esperada | Umbral de ruta | Rigor | Servicios | Cumplidos | % |
|---|---|---|---|---|---|
| `Campus` | 60 | `kml_full` | 397 | 204 | **51.4%** |
| `VOID` | 60 | `kml_full` | 280 | 24 | **8.6%** |
| `VOID` | 60 | `destino_only` | 77 | 0 | **0.0%** |
| `Campus` | 40 | `kml_full` | 65 | 51 | 78.5% |

La comparación está controlada: el mismo umbral (60) y el mismo rigor (`kml_full`) dan 51.4% contra 8.6%. **Lo único que cambia es a qué geocerca se le pidió llegar.**

**333 de 357 servicios** sobre rutas VOID quedaron `no_cumplido` o `pendiente_evidencia` en el periodo.

---

## 5. Cómo falla, exactamente

No es que la geocerca bloquee llegadas de unidades que sí corrieron la ruta. Eso se midió y es marginal: **una sola** ocurrencia tuvo una candidata que alcanzó el umbral de ruta sin registrar llegada.

Lo que pasa es anterior. Sobre las rutas VOID, **solo 26 de 357 servicios tuvieron alguna candidata que alcanzara el umbral de ruta** (7.3%). Sobre `Campus`, 274 de 462 (59.3%).

Es decir: en las rutas variante casi nada empata, ni por trazo ni por destino. Consistente con lo mismo — **al crear las variantes no se copió ni el destino ni un trazo que alguien maneje**, y quedaron esperando en un punto donde no pasa la operación.

Que 24 servicios sí salieran cumplidos sobre VOID dice que el punto no es inalcanzable, solo ajeno: alguna unidad pasa por ahí de vez en cuando.

---

## 6. Lo que este hallazgo NO es

La investigación que lo destapó buscaba otra cosa: si las 45 unidades sin servicio acreditado eran emparejamiento fallido. **No lo son**, y conviene dejarlo escrito para que nadie lo herede al revés.

Según el ledger del propio árbitro, deduplicado por ocurrencia, sobre 543 servicios sin unidad acreditada:

- **27** (5.0%) tuvieron a alguna de las 45 llegando a la geocerca esperada.
- **8 casos** quedaron a menos de 15 puntos del umbral de ruta — y 3 de ellos sobre servicios que salieron `cumplido` de todos modos.
- **41 de las 45 fueron evaluadas como candidatas**, cientos de veces cada una. El árbitro no las ignora: las considera y no empatan.
- El caso más fuerte (unidad 9190, 5 llegadas) mide **Fréchet 25.99 km contra un máximo de 0.8 km**, coincidencia de ruta 10.9% contra umbral 60. No es un empate perdido por poco: es otro camino.

Las 45 no están paradas. Ruedan —17 de ellas 20 o más días, con decenas de miles de puntos— y **15 de las 23 que ruedan no pisan un destino de cliente ni una vez en 30 días.** Hacen trabajo que J-Telemetry no ve, porque J-Telemetry solo ve lo contratado, y el único cliente real necesita unas 37 unidades.

Eso convirtió la cifra en un defecto de pantalla, no de motor, y se corrigió en el mismo PR: el titular decía *"45 de 82 unidades no cubrieron ningún servicio"*, con el denominador tomado de la flota del transportista y el numerador de la demanda de un cliente. Los dos números correctos, la frase falsa. §D del Marco, eje del ALCANCE.

---

## 7. La pregunta de producto que abre

**¿Debería el sistema negarse a generar ocurrencias contra una geocerca con rol `otro`?**

Hoy `service_occurrences.expected_geofence_id` acepta cualquier geocerca. Nada exige que sea de rol `destino`. Una ruta puede quedar dada de alta apuntando a un punto que no es un destino, y el motor sellará cientos de `no_cumplido` sin que nada suene — cada uno correctamente calculado y todos sobre una premisa falsa.

Es la misma forma del hallazgo de las cuentas no declaradas: **la marca existe y nadie la lee.**

Segunda pregunta, más barata: **¿debería avisarse cuando una ruta acumula N servicios sin que ninguna candidata alcance el umbral?** Esa señal —"aquí no empata nadie, nunca"— distingue una flota que falla de una ruta mal configurada, y hoy no existe.

---

## 8. Qué NO hacer todavía

- **No mover la geocerca.** Sellar de nuevo 357 servicios cambia resultados vinculantes, y eso es re-verificación explícita y auditada (Ley 2), no una corrección de datos.
- **No borrar VOID.** 24 hechos sellados la referencian.
- **No apagar las 21 rutas.** Los 189 servicios futuros son demanda real del cliente; lo que está mal es a dónde apuntan, no que existan.

Lo que sí urge decidir, porque corre el reloj: **qué pasa con los 189 servicios futuros** antes de que se conviertan en 189 `no_cumplido` más.
