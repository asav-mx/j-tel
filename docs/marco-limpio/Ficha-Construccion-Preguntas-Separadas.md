# Ficha de construcción — separar las dos preguntas, más el piso

**Gobierna:** el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**No decide nada.** El diseño está decidido en `Ficha-Diseno-C19-Tercera-Forma.md`
y ✅ **aprobado por Asav el 13 de agosto de 2026**. Esta ficha es **el orden de
construcción**: qué PR, qué toca, qué se mide y qué se puede medir solo.

---

## 1. Qué se decidió, en una línea

**El árbitro deja de contestar «cuál ruta» y «cuánto de ella» con una sola
expresión** — la atribución pasa a B, A se queda con la cobertura — **más un piso
de densidad** que impide que A opine cuando no hubo con qué mirar.

**Y por qué esa y no otra, con el número que lo cerró:** de las tres formas, la
de **cambiar la métrica** —usar la cobertura llana en vez de la ponderada— se
midió el 13 de agosto y salió en **CERO**: de los 74 acusados con la llana
sellada, **ninguno acreditaría**, porque **también fallan B**. El cuello no era
A: era **A junto con B**. Separar las preguntas es lo único que lo toca.

---

## 2. El orden, y qué toca cada paso

| PR | Qué entra | Término que toca | ¿Mueve un veredicto? |
|---|---|---|---|
| **1** | La densidad se calcula, se anota en el ledger y **se congela dentro del hecho** | ninguno | **No** |
| **2** | B se calcula contra **todas** las rutas del turno; el ledger guarda el ranking | ninguno | **No** |
| **3** | **La atribución pasa a B**, con su margen. A deja de decidir *cuál* | `corridorPrecisionPct` | **Sí** |
| **4** | **El piso se enciende**: sin densidad, A no opina y el servicio sale pendiente | `routeMatchPct` | **Sí** |

**Un término por PR, y el 4 después del 3** — el piso protege a A, y A solo queda
sola cuando la atribución ya se movió.

---

## 3. Lo que se puede medir por separado, que es lo que preguntaste

**Los pasos 1 y 2 son la medición de «antes», construida dentro del motor.**

No cambian un veredicto y **dejan registrado de antemano exactamente lo que los
pasos 3 y 4 van a mover**. Sin ellos, el efecto del 3 habría que medirlo por
fuera y contra una corrida distinta; con ellos, **cada hecho carga su propia
densidad y su propio ranking**, y el «después» se compara contra el «antes» del
mismo hecho.

| Paso | Qué se puede comprobar **sin esperar al siguiente** |
|---|---|
| **1** | Que la densidad del hecho **case con `medir-cadencia`**. Si no casa, el instrumento y el motor están midiendo cosas distintas y el resto no vale |
| **2** | Que el ranking del ledger **case con la corrida de solo lectura** ya existente |
| **3** | Cuántas candidatas atribuyen antes y después, **pareado por servicio** — no dos agregados |
| **4** | Cuántos `no_cumplido` pasan a pendiente |

---

## 4. Lo que cambió hoy y afecta lo que se espera del paso 4

⚠ **Planta 47 ya está en `destino_only`, y se ve funcionando:** en tres días
selló **41 cumplido · 22 pendiente · CERO no cumplido**. Sus servicios sin
atribución **ya salen como pendientes**, sin necesidad del piso.

**Consecuencia para la construcción:** el efecto del paso 4 **se concentra en el
Campus**, que sigue en `kml_full` y en los mismos tres días selló **46 no
cumplido**. Medir el paso 4 sobre los dos contratos juntos **promediaría dos
regímenes distintos** y daría un número que no describe a ninguno. **Se mide por
contrato.**

**Y la curva del piso, ya medida** — cuántos de los acusados con llegada quedan
por debajo según dónde se ponga:

| piso de densidad | alcanza a |
|---|---:|
| 45 s | 203 |
| 60 s | 80 |
| 90 s | 0 |

**Elegir el número es la decisión que queda del paso 4**, y no se toma aquí.

---

## 5. Las vallas que cada PR tiene que traer

Salen de lo que ya costó caro en este repo, no de una lista genérica:

1. **Cada paso, una prueba que muera si el paso se quita** (regla 8). Los pasos 1
   y 2 son especialmente fáciles de dejar sin vigilancia porque **no cambian
   nada**: una prueba que solo comprueba que el veredicto no se movió pasaría
   igual con el código borrado.
2. **Los pasos 3 y 4 traen su medición pareada, por contrato**, no un agregado.
3. **Ningún paso rellena hacia atrás.** Lo que se empiece a congelar nace vacío
   en lo ya sellado, y la pantalla tiene que decir «no se preguntó» — la ley que
   ya rige el expediente.
4. **`servedRoute` cambia en los pasos 3 y 4, y solo ahí.** En 1 y 2 tiene que
   salir idéntica, y **hay que probarlo**, no afirmarlo.

---

## 6. Lo que NO entra

- **Acreditar por llegar.** ⏸ Decidido por Asav el 13 de agosto: **después**, y
  por su razón — *convertir un pendiente en cumplido es mucho más caro de
  deshacer que al revés*. Primero se ve cómo se comporta el árbitro con las
  preguntas separadas.
- **Re-juzgar lo sellado.** Los pasos 3 y 4 cambian lo que viene; mover lo de
  atrás es **D4 / Tramo 6**, con firma.
- **Elegir el piso.** Es la decisión que queda, y va con la curva de §4 enfrente.
