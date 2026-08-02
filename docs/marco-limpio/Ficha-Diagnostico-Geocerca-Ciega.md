# Ficha de Diagnóstico — La geocerca ciega

**Gobierna:** el `Marco-Limpio-J-Telemetry-MAESTRO.md` y la compuerta de salida de Ola 2 del `PLAN-v1.md`.
**Estado:** hallazgo medido, con caso de prueba. **No se corrigió nada** — es diagnóstico, no arreglo.
**Salió de:** investigar por qué el inicio corporativo mostraba *"0 cumplidos · 20 no cumplidos"* en una cuenta.

---

## 1. El mecanismo, en una frase

> **Una geocerca dibujada demasiado chica convierte servicios cumplidos en `no_cumplido` sin que nada falle.** El GPS reporta, la cobertura da 100%, el motor aplica la regla correctamente, y el veredicto sale falso. No hay error que atrapar: hay una regla mal dibujada.

Esto es lo más peligroso que puede pasarle a este producto, porque **el árbitro se ve perfectamente sano mientras produce veredictos falsos.** Ninguna alarma se enciende: no hay excepción, no hay dato faltante, no hay hueco de señal. La medición es correcta y la afirmación es falsa.

---

## 2. El caso que lo destapó

Cuenta de prueba, sin datos reales — pero el mecanismo es real y medido.

**Veinte servicios `no_cumplido` seguidos**, del 2026-07-09 al 2026-08-01. El árbitro escribió la misma razón en los veinte: `ninguna_unidad_coincidio_ruta`.

| Lo que se midió | Valor |
|---|---|
| Cobertura de evidencia | **100.0%** (mínimo del contrato 80%) |
| Candidatas evaluadas | **1,032** |
| Candidatas que registraron llegada | **0** |
| Puntos GPS dentro de la geocerca | **0 de 135,256** |
| Acercamiento máximo de una unidad al centro | **123 m** |

Las unidades **llegaban al lugar correcto y se quedaban justo afuera de la caja.** El semieje de esa geocerca mide unos 55 m; los autobuses pasaban repetidamente a 123 m, 127 m, 188 m del centro, en días de servicio distintos.

**El motor no tiene un defecto.** Hizo exactamente lo que la configuración le pidió.

---

## 3. Por qué es genérico y no una anécdota

Medido sobre **todas** las geocercas de destino del sistema. La relación es monótona: entre más chica la geocerca, menos evidencia cae dentro, y menos cumplidos produce.

| Geocerca | Tamaño | Puntos dentro | Cumplidos |
|---|---|---|---|
| La del caso | **111 × 189 m** | **0.000%** (0 / 135,256) | **0.0%** (0 / 21) |
| Destino real (ubicación GPS) | 668 × 568 m | 0.059% (94 / 160,554) | 44.2% (23 / 52) |
| Campus | 500 × 500 m | 3.988% (83,538 / 2,094,841) | 55.2% (260 / 471) |

**Las dos columnas llegan a cero juntas, y en la misma fila.** Eso es lo que vuelve al mecanismo detectable en vez de anecdótico.

---

## 4. La cuarta causa

El `PLAN-v1.md` ya registra un dato hermano que espera explicación: **319 de 336 servicios de una planta se resolvieron sin ver una sola llegada**, y declara honestamente que no puede distinguir entre tres causas:

1. hora mal declarada
2. ventana angosta
3. unidades que no reportan

**Esta ficha aporta la cuarta: la geocerca no alcanza a cubrir dónde de verdad se detienen las unidades.**

Y aporta cómo separarla de las otras tres, que es lo que faltaba:

- Si fuera **hora mal declarada** o **ventana angosta**, la cobertura saldría baja o el paso de evidencia saldría indisponible. Aquí salió **100%**.
- Si fueran **unidades que no reportan**, no habría 135,256 puntos.
- Si fuera la **geocerca**, habría evidencia abundante, cero puntos dentro, y unidades acercándose a decenas de metros sin entrar. **Eso es exactamente lo que se midió.**

---

## 5. El caso de prueba para la compuerta de Ola 2

La compuerta de salida de Ola 2 es *"≥90% sostenido dos semanas, cero rojos sin expediente"*. Un `no_cumplido` producido por una geocerca ciega **pasa esa compuerta sin ruido**: tiene expediente, tiene evidencia, tiene razón escrita. Es un rojo perfectamente documentado y perfectamente falso.

**La señal que lo atrapa:**

> **De la evidencia de un alcance, qué porcentaje cae dentro de su geocerca de destino.** Si es cero mientras la cobertura es buena, la geocerca es ciega — no el transportista.

Los umbrales van al contrato como todo lo demás; el `0.000%` con `100%` de cobertura es el caso extremo que ya está medido y sirve de piso.

**Cómo se prueba sin datos reales:** encoger la geocerca de un alcance que hoy produce cumplidos hasta que el porcentaje de puntos dentro llegue a cero, y verificar que el diagnóstico la señale a ella y no al transportista. La tabla de §3 da los tamaños de partida.

---

## 6. La pregunta de producto que abre

**¿Debería el sistema avisar cuando una geocerca no registra ni una entrada en N días teniendo cobertura buena?**

Hoy nadie se entera. Este caso salió por accidente, investigando una cifra rara en una pantalla de inicio — y solo porque alguien preguntó por qué un número se veía sospechoso en vez de aceptarlo.

Es un diagnóstico construible con lo que ya existe: `evidencePoints`, `geofences.polygon` y el paso `cobertura_evidencia` del ledger bastan. **No necesita modelo nuevo.**

Lo que sí necesita decidirse:

1. **Dónde vive el aviso** — es un hallazgo de J-Staff, no de la cara cliente: acusa a una configuración, no a un transportista.
2. **Contra qué se compara** — el número de días y el piso de cobertura son perilla de contrato, no constante.
3. **Qué propone** — señalar la geocerca sospechosa es útil; **proponerle un tamaño** ya es calibración, y el auditado no edita el veredicto (Ley 5). El aviso informa; la corrección la hace quien tiene la autoridad.

---

## 7. Lo que esta ficha NO hace

- **No corrige ninguna geocerca.** Corregirla y re-verificar voltearía veredictos ya sellados: eso es parada obligatoria con aprobación humana explícita.
- **No acusa a una configuración concreta de estar mal.** Una geocerca chica puede ser correcta si el andén es chico. Lo que la vuelve sospechosa es **cero entradas con cobertura buena**, no su tamaño.
- **No propone el tamaño correcto.** Ver §6.3.
