# Ficha — Re-verificación de los hechos sellados con deadline corrido

**Fecha:** 30 de julio de 2026 · **Autoriza:** Asav (dueño de producto)
**Alcance:** 300 hechos sellados de Tecma Planta 47, del 2026-07-08 al 2026-07-29
**Estado:** aprobada, pendiente de ejecutar

---

## 1. Qué pasó, en una frase

El bug de zona horaria del cron dejó **434 ocurrencias con el deadline corrido 6 horas**. De esas, **302 ya tenían un hecho sellado** cuando se corrió la corrección — y esa corrección las excluyó **a propósito**, para no reescribir veredictos congelados.

Resultado: el árbitro juzgó 300 servicios de Planta 47 **mirando la ventana de evidencia equivocada** — en muchos casos, la noche anterior.

---

## 2. Qué mide la simulación (ya corrida, en seco, sin escribir)

Se reusó `verifyService()` —el mismo motor puro de producción— con el deadline
corregido y la evidencia leída de `telemetry_points` en la ventana correcta.
Contra `DATABASE_URL_READONLY`, sin una sola escritura.

| Estado | Hoy en la base | Con la ventana correcta |
|---|---:|---:|
| `cumplido` | **1** | **161** (54%) |
| `no_cumplido` | 254 | 139 (46%) |
| `pendiente_evidencia` | 45 | **0** |

**Lo que esto significa:** hay **160 servicios acusados de no cumplirse que sí se
cumplieron.** Y los 45 `pendiente_evidencia` no eran falta de señal — también
eran artefacto de la ventana mala: al simular con la ventana correcta, **ninguno
quedó pendiente.**

### Por ruta — Turno B (90)

| Ruta | cumplido / 15 |
|---|---:|
| Km 30 - B | 15 |
| Riveras 9 - B | 15 |
| San Jose - B | 13 |
| Juarez Nuevo - B | 13 |
| San Jose Auxiliar - B | 10 |
| **Huertas - B** | **0** |

### Por ruta — Turno A (210)

| Ruta | cumplido / 14 | Ruta | cumplido / 14 |
|---|---:|---|---:|
| Oasis - A | 13 | Riveras 9 - A | 6 |
| Colinas - A | 12 | Finca - A | 6 |
| San Isidro - A | 12 | Juarez Nuevo - A | 5 |
| Km 30 - A | 10 | Sanders - A | 5 |
| Safari - A | 10 | Riveras 7 - A | 3 |
| Finca Auxiliar - A | 7 | Km 20 - A | 2 |
| Sierra Vista - A | 4 | **Centro - A** | **0** |
| | | **Parajes del Sur - A** | **0** |

**Tres rutas fallan 100% incluso con la ventana correcta** (Huertas-B, Centro-A,
Parajes del Sur-A — 43 servicios). **Eso ya no es este bug** — es falla real que
estaba escondida bajo el ruido. Se investiga aparte; ver §8.

---

## 3. Por qué esto es legítimo bajo el Marco

La Ley 2 dice que **el hecho se calcula una vez y se congela**. No prohíbe
corregirlo: prohíbe **cambiarlo en silencio.** El propio Marco abre la puerta:

> La única forma de que cambie es una **re-verificación explícita y auditada**,
> con nombre de quién la pidió y hora.

Y la ley más alta del producto —**cero acusaciones sin evidencia**— exige la
corrección: dejar 160 acusaciones falsas contra el carrier en el expediente
contradice la razón de existir del árbitro.

**Entonces:** no se toca ningún hecho a escondidas. Cada uno se re-verifica como
**acto firmado**, el resultado anterior **no se borra** —queda en la historia del
sello, tachado y legible— y encima entra el nuevo con su motivo.

**Motivo canónico, idéntico en los 300:**

> `Corrección de deadline por bug de zona horaria del 2026-07-28. Autorizada por
> Asav el 2026-07-30. El veredicto anterior se emitió sobre la ventana de
> evidencia equivocada.`

---

## 4. El alcance exacto — la lista se congela primero

**Antes de escribir nada**, se genera y se guarda la lista explícita de las 300
ocurrencias: `occurrence_id`, `service_date`, ruta, turno, `fact_id` vigente,
estado actual, `materialized_at`. Esa lista es el alcance. **Nada fuera de ella
se toca.**

Criterio de selección (los tres juntos, no dos de tres):

1. `clasificarDiferencia(...).causa === "zona"` — la misma función que ya usa
   `corregir-deadlines.ts`. No una heurística nueva.
2. Tiene `compliance_fact` sellado.
3. Pertenece a Tecma Planta 47.

**Excluidas explícitamente:** las 2 ocurrencias del contrato de prueba
(`Destino Prueba`, 2026-07-08). No son dato real y no entran.

Esa lista se guarda como artefacto (`docs/correcciones/` o equivalente) **antes**
de ejecutar, y sirve de base para la verificación posterior y para la reversa.

---

## 5. El procedimiento

**Por cada ocurrencia de la lista, y solo de la lista:**

1. **Corregir el deadline** de la ocurrencia con `computeExpectedDeadline` (misma
   función canónica; nada de construir fechas a mano).
2. **Archivar el hecho vigente** en la historia del sello — no borrarlo. Usar la
   maquinaria que ya existe (`insertHistoryEntry` / `updateHistorySuccessor`), la
   misma que alimenta el componente de historia del sello.
3. **Re-verificar** con `verifyService()` sobre la ventana correcta,
   **leyendo la evidencia de `telemetry_points`** — la memoria propia, exactamente
   el mismo camino que usó la simulación.
4. **Sellar el hecho nuevo** con su entrada de ledger, que lleva el motivo
   canónico de §3 y el nombre de quien autorizó.

**Regla dura sobre el paso 3:** la ejecución debe usar **el mismo camino de código
que la simulación**. Si se usa el camino en vivo que consulta al proveedor GPS,
los números no van a coincidir y no vamos a saber por qué. Mismo camino, mismos
números.

### Guardas antes de correr

- **El cron de verificación apagado** mientras dure la corrida. Dos manos
  escribiendo sobre los mismos hechos es la peor forma de perder la trazabilidad.
- **Enforcement sigue apagado.** No se enciende ni por accidente: esta corrección
  no debe disparar ningún cobro ni descuento.
- **Transacción por ocurrencia.** Si una falla a la mitad, esa ocurrencia queda
  como estaba, no a medias.
- **Ninguna ocurrencia fuera de la lista congelada.** La guarda viaja dentro del
  `WHERE`, como en la corrección de deadlines: si algo cambió entre que se generó
  la lista y que se corre, esa fila **no se toca**.

### Orden de ejecución — por partes, no de golpe

1. **Primero 5 ocurrencias**, elegidas a propósito: 2 que la simulación dice que
   pasan a `cumplido`, 2 que siguen `no_cumplido`, y **la única `cumplido` actual**
   (ver §6).
2. **Parar.** Asav abre esas 5 en el expediente y confirma con sus ojos que la
   historia del sello se ve correcta: el resultado anterior tachado y legible, el
   nuevo encima, con su motivo y firma.
3. **Solo con ese visto bueno**, correr las 295 restantes.

---

## 6. El caso que corta para el otro lado

Hoy hay **1 servicio en `cumplido`** dentro de las 300 (Safari-A, que por azar
cayó bien con la ventana mala). Si al re-verificar se voltea a `no_cumplido`,
**eso es una acusación nueva**, no la corrección de una falsa.

Es un caso, pero el principio no es negociable: **la verdad corta para los dos
lados.** Antes de escribirlo, Devin reporta explícitamente qué pasa con ese caso
y Asav lo aprueba aparte. No entra en el lote silenciosamente.

---

## 7. Verificación posterior — la prueba de que salió bien

Al terminar, los conteos de la base deben ser **exactamente** los de la
simulación:

| Estado | Esperado |
|---|---:|
| `cumplido` | 161 |
| `no_cumplido` | 139 |
| `pendiente_evidencia` | 0 |

**Si no coinciden, se para y se investiga antes de seguir.** Una diferencia
significa que la ejecución no corrió por el mismo camino que la simulación, y
entonces no sabemos qué se escribió.

Además:
- Las 300 tienen historia del sello con **2 versiones** (anterior + vigente).
- Ninguna ocurrencia fuera de la lista cambió de estado.
- Ninguna entrada de ledger nueva fuera de las 300.

### Reversa

La lista congelada de §4 guarda el estado anterior de cada hecho, y la historia
del sello conserva la versión previa completa. Si algo sale mal, se puede
reconstruir el estado anterior desde ahí. **No se ejecuta nada sin que esa lista
esté guardada primero.**

---

## 8. Lo que esta ficha NO resuelve

- **Las tres rutas rotas** (Huertas-B, Centro-A, Parajes del Sur-A). Diagnóstico
  de Huertas: no es la geocerca —entran 14-15 unidades al destino cada día— y sí
  se da el servicio; **el trazado KML grabado no corresponde al camino real que
  manejan las unidades**. La mejor candidata alcanza 33-44% de match contra el 60%
  requerido, con 5-6 km de distancia al trazado. Requiere que un humano abra el
  KML en un visor y lo compare a ojo contra el trazo real. **Es un frente propio.**
- **El "Ver como"** que expone nombres de otras cuentas en la cara de cliente.
  Pegado a `auth-rbac`.
- **La regla de cierre del pendiente por evidencia.** Sigue siendo decisión de
  producto pendiente.

---

## 9. Nota de negocio, no de código

Si a Tecma ya se le mostraron los números malos de Planta 47, esta corrección los
cambia de forma visible: de ~0% a 54% de cumplimiento. **Es buena noticia** —el
sistema detectó su propio error, lo midió, y lo corrigió dejando rastro firmado—
pero conviene contarlo antes de que lo vean, no después.

Y hacia el carrier: **160 servicios dejan de estar acusados injustamente.** Esa
conversación también es mejor tenerla de frente.

---

## 10. Por qué esto vale más que la corrección

Antes de esto, el número de cumplimiento de Planta 47 era una ficción. No se podía
medir el **≥90% de v1** contra una base envenenada.

Esta corrección no lleva al 90% — lleva al **54% real y medible**, que es la
primera línea de salida honesta que tiene el proyecto. Y de paso destapa 43
servicios de falla genuina que llevaban semanas escondidos bajo el ruido.

**Sin esto, la meta de v1 no se puede ni intentar.**
