# Ficha de insumo — C16: qué está corriendo en cada contrato, y qué costó correrlo así

**Fecha de medición: 11 de agosto de 2026** · **Alcance:** solo lectura, con
`jtel_readonly`. **No se selló nada, no se re-verificó nada, ninguna
configuración se tocó.** Sin cuentas demo: solo Tecma.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

> **Qué es.** El material para la conversación con la Planta. **No decide nada y
> no propone valores.** C16 no se cierra desde el repo —lo que se pactó no está
> en la base, ésa es la causa entera—, así que lo único que se puede hacer aquí
> es poner enfrente **qué está corriendo hoy, campo por campo**, y **qué costó
> que corriera así**.
>
> Reproducible: `pnpm --filter @jtel/db comparar-politicas`.

---

## 1. Un campo puede diferir de tres maneras, y las tres se ven igual en un JSON

Ésta es la distinción de la que depende toda la ficha:

| Clase | Qué significa | Por qué importa |
|---|---|---|
| **difiere** | Los dos contratos lo declaran, con valores distintos | Alguien decidió dos veces. Puede estar bien — hay que preguntarlo |
| **solo en uno** | Uno lo declara y el otro no | El que no lo declara **corre con el valor de fábrica sin que nadie lo eligiera**. No es un acuerdo: es una omisión que se comporta como acuerdo |
| **igual** | Los dos lo declaran igual, o ninguno lo declara | Coinciden. Si es porque ninguno lo declara, también hay que decirlo |

> **Un campo ausente no es un campo en blanco: es el `default` del esquema
> aplicándose en silencio.** Por eso la tabla imprime el valor efectivo al lado
> del declarado — quien lee tiene que poder distinguir **«se pactó 120»** de
> **«nadie dijo nada y quedó 120»**.

---

## 2. Lo que está corriendo · 25 campos

🟢 **8 difieren · 7 existen solo en Planta 47 · 10 coinciden.**

⚠ **La cifra cambió desde el corte del 6 de agosto, que decía «dieciséis de 24», y
las dos razones están fechadas:** el esquema pasó de 24 a **25** campos cuando
C12 metió `frechetMaxKm` (#269, 8 de agosto), y `kmlOriginToleranceFraction`
**dejó de diferir** al escribirse en el Campus el 6 de agosto. **No es que se
hayan arreglado divergencias: es que la lista se midió otra vez.**

### 2.1 Los ocho que difieren · ⚖ = decide un veredicto

| Campo | Campus | Planta 47 | Qué decide, en una línea |
|---|---|---|---|
| ⚖ **`routeStrictness`** | `kml_full` | **`destino_only`** | Si basta con llegar al destino o hay que acreditar el trazado. **Es la divergencia más cara de la lista** — ver §4 |
| ⚖ **`kmlCorridorMeters`** | **150 m** | **120 m** | El ancho del corredor. **Y es lo único que separa a los dos sitios en tolerancia al muestreo** — ver §3 |
| ⚖ **`kmlCorridorMinPct`** | **50 %** | **60 %** | Métrica B: qué fracción de los puntos debe caer dentro del corredor. 🔵 Asav lo recordaba acordado en **60 %** para el Campus |
| ⚖ `arrivalAnticipationMinutes` | 20 | 15 | Cuántos minutos antes del turno debe estar la unidad en la geocerca |
| ⚖ `verificationGraceMinutes` | 10 | 15 | Cuánto espera el motor tras el deadline antes de sellar |
| ⚖ `excusableReasons` | sin **`falla_mecanica`** | con `falla_mecanica` | Qué retrasos no se le imputan al carrier. **En el Campus una falla mecánica no es excusable y en Planta 47 sí** |
| `enforcementRules` | **`[]` vacío** | `no_pago_viaje` a 5 min | La consecuencia. **El Campus no tiene ninguna configurada** |
| `evidenceMarginMinutesAfter` | 45 | 30 | Cuánto se mira después del deadline |

### 2.2 Los siete que solo existen en Planta 47 — y no son siete campos sueltos

| Campo | Valor de fábrica que corre en el Campus |
|---|---|
| `windowDerivationEnabled` | `true` |
| `windowSlackPct` | 25 |
| `routeAvgSpeedKmh` | 20 |
| `routeDurationPercentile` | 90 |
| `routeDurationMinSamples` | 3 |
| `maxWindowBeforeMinutes` | 360 |
| ⚖ `timeZone` | `America/Ciudad_Juarez` |

> 🟢 **Seis de los siete son la misma pieza: cómo se dimensiona la ventana de
> observación.** No es que al Campus le falten seis ajustes finos — es que
> **nadie configuró el dimensionado de su ventana**, y el motor lo está haciendo
> con los valores que trae el esquema. La ventana decide **qué evidencia se mira
> para juzgar**, así que esto no es cosmético.
>
> ⚖ **Y el séptimo es `timeZone`, que es de donde salió D1.**

### 2.3 Los diez que coinciden — dos merecen decirse

- ⚖ 🟢 **`kmlMatchMinPct` es 60 en los dos.** El umbral de la **cobertura** (A) no
  divide a los contratos; lo que los divide es el de **corredor** (B) y el ancho.
  Va dicho porque los dos umbrales se parecen en el nombre y **confundirlos
  cambia la cifra sin que nada se vea mal** — pasó al medir C19, y está corregido.
- 🟢 **`shiftCloseMinutesAfterStart` no lo declara ninguno, y no tiene valor de
  fábrica.** Así que **ningún contrato real tiene hora de cierre de turno**. La
  pantalla lo trata como «turno histórico sin hora de cierre» y no la inventa,
  que es correcto — pero hoy la ausencia **no distingue «no existía la perilla»
  de «nadie la configuró»**.
- 🟢 `frechetMaxKm` tampoco lo declara ninguno: los dos corren con **0.8** de
  fábrica, y eso es exactamente el arreglo de C12 — el default vive en el esquema
  y ya no horneado en el motor.

---

## 3. Qué costó pactarlo así — la configuración decide cuánta ceguera aguanta un sitio

🟢 **Medido el 11 de agosto** con el grupo de control de C19 (adelgazar la
evidencia hasta una densidad menor, con todo lo demás fijo):

| Adelgazado a | Planta 47 · 120 m | Campus · 150 m |
|---|---|---|
| **tal como está** | **94** acreditan | **155** acreditan |
| 1 punto / 60 s *(el régimen de julio)* | **58** · −38 % | **115** · −26 % |
| 1 punto / 120 s | **0** | **23** |

> 🟢 **Con `kmlMatchMinPct` idéntico en los dos (60 %), lo único que separa a los
> sitios en esta tabla es el ancho del corredor: 150 m contra 120 m.** Treinta
> metros compran la diferencia entre **quedarse en cero** y **conservar 23**
> cuando el aparato ralea.
>
> **La conversación deja de ser «qué se pactó» y pasa a ser «qué se pactó y qué
> costó pactarlo así».** Un corredor más estricto no solo exige más al carrier:
> **lo vuelve más frágil ante una cosa que el carrier no controla**, que es la
> cadencia del proveedor de GPS. Nadie eligió ese intercambio, porque nadie lo
> tenía medido.

---

## 4. La divergencia más cara, y no es un umbral

⚖ **`routeStrictness`: el Campus corre `kml_full` y Planta 47 `destino_only`.**

🔵 Y C14 ya midió lo que eso significa hoy: **los 48 ruta-turnos de los dos
contratos tienen KML activo**, y `!hasKml` es **lo único** que apaga la
comprobación A∧B. Así que:

> **El contrato de Planta 47 dice «basta con llegar al destino» y el motor no
> puede decirlo.** `destino_only` está **inerte**: una unidad que llegó a la
> geocerca pero no acredita el trazado **no puede salir `cumplido` jamás**.

Es la única divergencia de esta lista donde **lo pactado y lo aplicado no
coinciden aunque la configuración esté escrita correctamente**. Las demás son
«¿es éste el valor que acordamos?»; ésta es «el valor que acordamos no se está
aplicando». Tiene frente propio y va por su cuenta.

---

## 5. Las preguntas concretas para la Planta

Ordenadas por lo que cuestan si la respuesta es «eso no fue lo que acordamos»:

1. **¿El Campus se contrató como `kml_full`?** Es la diferencia entre exigir el
   trazado y exigir la llegada, y **es la que más veredictos mueve**.
2. **¿El corredor del Campus es 150 m y su precisión 50 %?** 🔵 Asav recordaba
   **60 %**. Y ahora se sabe lo que cambia además del rigor: **cuánta ceguera
   aguanta el sitio** (§3).
3. **¿El Campus se quedó sin consecuencia a propósito?** `enforcementRules` está
   **vacío**: el árbitro sella y no hay nada pactado que se apoye en el sello.
4. **¿Una falla mecánica es excusable en el Campus?** Hoy **no** lo es ahí y **sí**
   en Planta 47.
5. **¿Alguien decidió el dimensionado de la ventana del Campus?** Hoy corre
   entero con valores de fábrica (§2.2).
6. **¿Hay hora de cierre de turno?** Hoy **ninguno de los dos** la tiene.

---

## 6. Lo que esta ficha NO hace

- **No dice qué se pactó.** No está en la base — ésa es C16 entera.
- **No propone valores** ni toca una sola configuración.
- **No cierra C16.** Se cierra con la respuesta de la Planta, y **con
  `contract_policy_history` llenándose** (C13, ya con su trigger desde la 0020),
  que es lo que hará que la próxima vez esta pregunta se pueda contestar leyendo
  el sistema en vez de recordando.
