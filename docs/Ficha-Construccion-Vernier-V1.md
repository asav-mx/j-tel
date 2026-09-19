# Ficha de construcción · Vernier V1 — el cuarto «Servicios especiales»

**Referencia visual obligada:** el prototipo v1 (https://claude.ai/artifact/XDTRABFFkk2nVjqzC5SQDC). Lo que esta ficha no diga, lo dice el prototipo. Si los dos callan, pregunta antes de improvisar. **Donde el prototipo contradice esta ficha o el motor, manda la ficha** — ver «Enmiendas del 18-sep» al final: el prototipo inventó un veredicto (la llegada tarde como no cumplido) y dibujó trazas que el motor no tendría.

**Proceso:** rama propia, PR aparte de C4-e y del PR de trazas. Checks verdes no son aprobación; la aprobación es de Asav. Toca cómo se muestra lo sellado, no cómo se sella: el motor no se toca en esta ficha.

**Validada contra el Marco el 18-sep** (Piezas 1, 6 y 7). Las tres correcciones que salieron de esa validación están marcadas abajo como **[Marco]**. **Enmendada el mismo 18-sep** al revisar el plan contra el repo; las enmiendas van marcadas **[18-sep]** y su registro está al final.

## 0 · Vocabulario obligatorio — [Marco]

El Marco tiene tres palabras donde es fácil decir «servicio», y esta ficha usa cada una en su sitio:

- **Perfil de servicio** (Pieza 1.A) — el contrato ya concreto: su geocerca, su ruta, su turno y **su conjunto de unidades posibles**. No es «ruta × turno» a secas.
- **Ocurrencia de servicio** — un perfil en una fecha. **Cada pieza de la lista es una ocurrencia.**
- **Hecho de cumplimiento** — la única verdad guardada de esa ocurrencia. **El acta lee el hecho; no lo recalcula** (6.32; «la verdad se calcula una vez y se guarda»).

Nombres de código, rutas y textos de pantalla se escriben con este vocabulario, no con «servicio» a secas.

---

## 1 · Qué se construye

El cuarto **Servicios especiales** en la casa nueva, cara transportista, con el sello **VERNIER** encima de la sección (como COMPÁS sobre la suya). Dos niveles: la **lista** de servicios juzgados y el **acta** (`Ver ‹ruta› · ‹turno› · ‹fecha›`).

**[18-sep]** El lugar del menú se llamaba «Cumplimiento» en el mapa de la casa y en `casas.ts`. Pasa a llamarse **«Servicios especiales»**: sigue siendo nombre de cosa (opción B), y el adjetivo evita que un carrier con concesión busque ahí sus circuitos. El mapa se corrige en el mismo PR. «Contratos y perfiles» sigue declarado sin cuarto: **no se dibuja** (lo que no existe, no se pinta).

Condiciones de existencia:

- El cuarto existe **sólo si la cuenta tiene contrato**. Sin contrato no aparece ni la pestaña — no se muestra bloqueado: no existe.
- Lista **sólo servicios de modalidad especial**. Los circuitos de transporte público viven en su propio cuarto futuro (Circuitos) y no entran aquí.
- Los cuartos viejos `carrier/cumplimiento`, `carrier/historial` y `carrier/reportes` **no se migran como cuartos**: la ventana de tiempo los disuelve. No se apagan en este PR; eso se decide cuando este cuarto ruede.

Regla sana: el código no conoce «Planta Norte» ni ningún nombre; todo ejemplo de esta ficha es ejemplo. Cualquier cuenta, cualquier contrato, cualquier número de turnos.

## 2 · La lista

**Ventana de tiempo** (misma pieza que C3): flechas ‹ ›, rango visible, y atajos exactos: **Hoy · Ayer · Esta semana · Este mes**.

- «Esta semana» = **lunes 00:00 de la zona horaria de la cuenta → el momento de mirar**, sin importar el día. No existe «últimos 7 días».
- **[18-sep]** La pieza sale de C3 a un componente compartido, y **C3 también cambia** «Últimos 7 días» por «Esta semana»: la misma palabra significa lo mismo en toda la casa. Captura del antes y del después de Compás en el PR.
- **[18-sep] La zona de la cuenta** es la de su **mercado**; si la cuenta no tiene mercado, la de la **política de su contrato**. La cuenta no tiene zona propia. Las demás pantallas que siguen con la zona fija del despliegue quedan como pendiente con nombre.

**Filtros, todos combinables entre sí y con la ventana:**

- **Contratos:** fila de chips (`Todos los contratos · ‹contrato A› · ‹contrato B›…`), uno activo a la vez. **Sólo aparece si la cuenta tiene más de un contrato.** Con uno solo, la fila no existe.
- **Turnos:** chips con su ventana horaria (`T1 · 06:45–06:50`), prenden y apagan. Los turnos salen del perfil de la cuenta, no de una lista fija.
  - **[18-sep] La ventana del turno se arma con lo sellado:** llegada exigida (la hora límite que congeló la ocurrencia) → límite con tolerancia (la de la política congelada en el hecho). Es la misma ventana contra la que se juzgó, no una reconstruida. Si falta un dato en el sello, el renglón lo declara en vez de calcularlo.
- **Buscador:** una caja que busca **dentro de la ventana elegida** por ruta, unidad, turno, fecha, contrato y veredicto. Cada término tecleado debe coincidir (búsqueda tipo «todas las palabras»).
- **Conteos:** franja `‹N› servicios` + tres chips de veredicto con glifo y número; cada chip filtra por su veredicto (toggle). **Ley de coherencia: los conteos cuentan exactamente lo que la lista muestra** — ventana + contrato + turno + búsqueda —, sin aplicar el propio filtro de veredicto. Un número arriba que no cuadre con las piezas abajo es un defecto.
  - Una ocurrencia **sin hecho todavía** no entra ni se cuenta: no es un veredicto, y ponerla junto a los tres se leería como un cuarto (Marco §D, caso 2).

**Orden: bloques cronológicos.** Fecha más reciente arriba; dentro de cada fecha, los turnos en el orden en que ocurren (T1 → T2 → T3…). Título de bloque: `‹DÍA FECHA› · ‹turno› · ‹ventana horaria›`; si la ventana es de un solo día, el bloque omite la fecha. El riesgo **no** ordena la lista: el triage se hace con los chips de conteo.

**La pieza:** glifo del veredicto · ruta (Bricolage) · línea de apoyo (`‹contrato› · ‹motivo corto› · unidad ‹n›`) · a la derecha la hora del sello en mono con etiqueta `SELLADO` (en ladrillo si no cumplido). **[18-sep]** Si el hecho fue re-sellado, la etiqueta dice `RE-SELLADO`. Vacíos honestos: sin servicios en la ventana o con el filtro, caja punteada «Nada en esta ventana con ese filtro».

## 3 · El acta (`Ver ‹ruta› · ‹turno› · ‹fecha›`)

Miga de pan de regreso a la lista. Familias, en este orden:

**Veredicto** — glifo grande + nombre (`Cumplido / Pendiente de evidencia / No cumplido`), `SELLADO ‹fecha› · ‹hh:mm:ss›` en mono. Abajo, el **motivo en lenguaje de evidencia**, y cuando el veredicto se decidió por un número, **la cifra con su umbral** en mono (`Llegada 07:12:41 · límite 07:05:00`). Cierra la leyenda `HECHO CONGELADO · SE CALCULÓ UNA VEZ Y NO SE RECALCULA`. La pantalla **lee lo sellado; jamás recalcula al abrirse.**

- **[18-sep] Una llegada tarde es Cumplido con timing tarde**, nunca un no cumplido (Pieza 3: el status es cumplido y «tarde» vive en timing; la consecuencia es enforcement). **El timing se muestra**: `Cumplido · tarde`, con la cifra `Llegada 07:12:41 · límite 07:05:00`. Para quien cobra, llegar tarde no es lo mismo que llegar a tiempo aunque el veredicto sea el mismo. **El timing no lleva glifo propio**: el hexágono es del veredicto.
- **[18-sep] El motivo se lee del paso `decision` del ledger** que el motor escribió en la misma corrida del sello (leer no es recalcular). Un no cumplido es «ninguna unidad sirvió / coincidió con la ruta»; un pendiente es sin datos, señal insuficiente, llegada sin atribuir u observación insuficiente. **Si el ledger no quedó emparejado con el sello vigente, el acta dice «Motivo no registrado en este sello»** — no se deduce.
- **[18-sep] Re-sellos.** Si el hecho fue re-sellado (hay historia en `compliance_fact_history`), la leyenda de «se calculó una vez» sería mentira. En su lugar: `RE-SELLADO ‹fecha› · ‹hh:mm:ss›` y `EL SELLO ANTERIOR QUEDA EN LA HISTORIA`. Esta ficha daba por hecho que todo sello es único; no lo es.

**Identidad** — renglones separados, nunca fundidos: Perfil de servicio · Ruta · Turno **con su ventana horaria** · Fecha (larga) · Contrato · **Unidades posibles** (lo esperado, del perfil) · **Unidad observada** (lo que la evidencia mostró). Un perfil se repite todos los días; una ocurrencia pasa una vez — por eso perfil y fecha van aparte.

**[Marco] Esperado y observado nunca se mezclan** (Pieza 1.C). Por eso son dos renglones y no uno: «unidad atribuida» fundía los dos. Cuando no hubo unidad observada (el caso de llegada sin atribuir), el renglón lo declara — no se deja vacío ni se rellena con la esperada.

- **[18-sep]** Las unidades posibles **no se congelan con el hecho**: el perfil guarda el conjunto de hoy. El renglón se rotula **«Unidades posibles · según el perfil hoy»**. Congelarlas con el hecho es decisión de motor: pendiente con nombre.

**Evidencia** — la traza del servicio: **rota donde no hubo datos, partida en los saltos, cortada al entrar a la geocerca de destino**, con su nota. Debajo, la línea de hechos: hora en mono + hecho; los huecos con borde punteado y su duración. **Cada hecho nombra la frontera de geocerca que se cruzó** («Entrada a la geocerca de destino»), nunca el suceso supuesto («llegó al destino»).

- **[18-sep] La traza es de la unidad observada**, con los puntos de evidencia que guardó el viaje —los mismos con que juzgó el motor—, cortada en la llegada sellada. **Sin unidad observada no hay traza**: «Ninguna traza es de esta ocurrencia». Dibujar candidatas sería especular (el prototipo mostraba una traza con hueco en un caso donde no la habría).
- **[18-sep] No existe geocerca de origen** (los roles son destino, base, caseta y otro). **No se declara la ausencia en cada acta**: una frase repetida en el 100 % de las actas es ruido que enseña a ignorar (6.17). El primer renglón de la línea de hechos nombra lo que sí se midió: **«Primer punto medido del viaje»**. Si algún día hay rol de origen, ahí aparece su frontera.
- La única frontera que el sello guarda es la **llegada** (la hora de entrada a la geocerca de destino). Los huecos y saltos de la línea son los de la traza de la unidad observada.

**Justificación** — por ahora sin flujo: el flujo de justificaciones (§D del mapa) es otra ficha.

- **[18-sep]** La pantalla vieja ya guarda la versión del transportista (`carrier_aportaciones`). El acta **la lee**: con cero filas, «Sin justificación presentada»; con filas, las lista en sólo lectura (motivo, estado, fecha). Decirlo a ciegas sería afirmar lo que no se comprobó.

## 4 · Leyes visuales (actualizar el skill `jtel-diseno` en este PR)

**Cuarta familia de formas — el sello (hexágono):**

| Veredicto | Forma | Color |
|---|---|---|
| Cumplido | hexágono lleno | `--sello-ok` (nuevo): claro `#2E6A4E`, oscuro `#7FBFA0` |
| Pendiente de evidencia | hexágono de contorno punteado | tinta |
| No cumplido | hexágono hueco tachado con diagonal | `--ladrillo` (nuevo): claro `#A93636`, oscuro `#FF8177` |

- `--sello-ok` es un verde **sobrio, deliberadamente distinto** del verde brillante del latido (`--vivo`); el latido sigue siendo lo único que brilla.
- `--ladrillo` es exclusivo del no cumplido. `--sello-ok` y `--ladrillo` **no se usan en ningún otro lugar de la plataforma**.
- **Cero cobre en este cuarto**: nada aquí está vivo. **Cero dinero**: la consecuencia económica vive en el futuro estado de cuenta.
- La forma carga el estado; el color acompaña. Ambas pieles con sus propios valores.
- **[18-sep]** El timing (temprano, a tiempo, tarde) no lleva glifo: va en palabras junto al veredicto.

## 5 · Datos

Sólo lectura de lo que el motor selló (veredictos, timing, llegada, llegada exigida, política congelada, el paso `decision` del ledger del sello vigente, los puntos de evidencia del viaje de la unidad observada, las aportaciones del transportista). El muro de cuenta ya vive en el motor (#441/#442); esta pantalla no lee evidencia sin cuenta — la prueba guardiana ya lo vigila. Cada lectura nueva une la ocurrencia con su contrato y exige la cuenta del cuarto.

## 6 · Pruebas mínimas

1. Conteos = lista bajo cualquier combinación de ventana, contrato, turno, búsqueda y chip de veredicto.
2. «Esta semana» arranca el lunes 00:00 de la zona de la cuenta (probar en lunes y en domingo).
3. Bloques: fechas descendentes, turnos ascendentes dentro del día; fecha en el bloque sólo con ventana multi-día.
4. Sólo modalidad especial en la lista; un servicio de público jamás aparece.
5. Cuenta sin contrato → el cuarto no se renderiza (ni pestaña).
6. Cuenta con un solo contrato → la fila de contratos no existe.
7. El acta muestra lo sellado sin disparar recálculo (verificable: abrir el acta no escribe ni recalcula nada). **[18-sep]** Con un repositorio espía: cualquier lectura fuera de las del cuarto revienta la prueba.

## 7 · Estacionado a propósito (no construir)

- Evidencia de **lo que sí se hizo** en un no cumplido (pendiente con nombre, decidido por Asav 18-sep).
- Estado de cuenta / dinero.
- Flujo de justificaciones (§D).
- Apagar los cuartos viejos del carrier.
- **[18-sep]** Congelar las unidades posibles con el hecho (decisión de motor).
- **[18-sep]** Pasar la zona de la cuenta a las demás pantallas que siguen con la del despliegue.

## 8 · Advertencia honesta

Con datos reales, este cuarto va a mostrar los pendientes de evidencia del destino compartido: los que el motor sella con `llegada_sin_atribucion` — una unidad entró a la geocerca de destino pero su recorrido no alcanza el mínimo de ninguna ruta —, concentrados en **Planta 47 · Turno A**. **[18-sep]** No se escribe ninguna cifra: el número se mide cuando el cuarto ruede. **No es un defecto de la pantalla**: es la verdad dibujada. No suavizarlo, no esconderlo, no inventarle un filtro que los oculte por omisión.

**[Marco] Pero tampoco es estado normal.** La ley 6.17 dice que toda alarma tiene que poder llegar a cero, y que lo que justifica una excepción es lo que hay que arreglar. Así que el cuarto nace con una deuda declarada y con dueño: **la guardia de atribución de Planta 47**, que es decisión de motor y de negocio, no de pantalla. Mientras esa deuda viva, los pendientes son deuda visible; el día que se salde, el chip de pendientes debe poder marcar cero. Si al construir se siente la tentación de «arreglarlo» desde la pantalla, esa tentación es la señal de que el arreglo va en otro lado.

---

## Enmiendas del 18-sep (al revisar el plan contra el repo)

Decididas por Asav el 18 de septiembre de 2026. Cada una corrige algo que la ficha o el prototipo daban por hecho y que el repo contradice:

1. **Nombre:** «Servicios especiales», no «Cumplimiento»; el mapa se corrige en el mismo PR. «Contratos y perfiles» no se dibuja.
2. **Llegada tarde = Cumplido · tarde.** El prototipo inventó un no cumplido que el motor no produce. El timing se muestra, sin glifo propio.
3. **El motivo sale del paso `decision` del ledger.** Hecho viejo sin motivo: «Motivo no registrado en este sello».
4. **Sin geocerca de origen:** no se declara la ausencia en cada acta; el primer renglón es «Primer punto medido del viaje».
5. **Traza sólo de la unidad observada;** sin ella, «Ninguna traza es de esta ocurrencia».
6. **Zona:** la del mercado de la cuenta, con la política del contrato de respaldo. Lo fijo de otras pantallas, pendiente con nombre.
7. **La barra de ventana es compartida** y C3 también dice «Esta semana». Antes y después de Compás en el PR.
8. **Justificación:** se leen las aportaciones del transportista antes de decir que no hay.
9. **«Unidades posibles · según el perfil hoy».** Congelarlas es pendiente de motor.
10. **Re-sellos:** «RE-SELLADO ‹fecha› · el sello anterior queda en la historia», en vez de la leyenda de sello único.
11. **La ventana del turno se arma con lo sellado;** lo que falte, se declara.

Y una corrección de la propia ficha: la cifra de pendientes del §8 se había citado de memoria y no está medida en el repo (lo último medido: 87, el 12 de agosto). Se quitó; el número se mide cuando el cuarto ruede.
