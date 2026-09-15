# Trampas de medición, y lo que una pantalla puede afirmar

**Qué es.** Lo que se rescató del skill `j-telemetry-ui` antes de borrarlo (#407),
porque no era piel: compartía archivo con ella. Viene en **dos partes con estatus
distinto**, y la diferencia importa:

- **Parte 1 · Trampas de medición.** Trece lecciones de método, cada una con el caso
  que la enseñó, para quien vaya a decidir algo contra un número medido. Siguen
  vigentes.
- **Parte 2 · Candidatas al Marco. NO son ley.** Reglas sobre qué afirma una pantalla.
  Eso es material del Marco, y dejarlas aquí como ley haría dos fuentes diciendo lo
  mismo y divergiendo. Esperan su comparación contra el Marco.

**Por qué se rescataron.** Sólo vivían en el skill. El skill se borró el 15 de
septiembre de 2026 porque la piel y el lenguaje viejos se rehacen, no se reforman.
Es lo mismo que casi pasa con las secciones D, E y F del Marco.

**Qué gobierna.** Nada visual: las pantallas las gobierna el skill nuevo cuando
exista. Si algo de aquí choca con el `Marco-Limpio-J-Telemetry-MAESTRO.md`, gana el
Marco.

**Se copiaron tal cual.** Los únicos cambios son dos: el nombre de la ficha de datos
no declarados ahora es un enlace a donde vive, y los títulos de la Parte 2 bajaron un
nivel para caber en su sección. La versión original sigue en la historia:
`git show fe3b36d:.claude/skills/j-telemetry-ui/SKILL.md`.

---

## Parte 1 · Trampas de medición

Muchas decisiones de este producto se toman contra un número medido: si una columna se muestra, si un hallazgo es real, si una consulta se sostiene. **Un número mal medido decide igual de fuerte que uno bien medido**, y no se nota. Estas son las que ya cayeron, con el caso que las enseñó.

**Medir sobre un entorno que uno mismo pisó.** Correr `pnpm build` con el servidor de desarrollo vivo sobrescribe `.next`, y lo que se mide después no es la aplicación: es el servidor recompilando encima de sus propios archivos rotos. Sobre esa medición se quitaron columnas de producto.

Y la parte que importa más: al rehacerla con servidor limpio, el número se sostuvo. **Eso no valida la primera.** Una medición contaminada que por casualidad coincide con la buena sigue sin ser evidencia — la conclusión sobrevivió, el método no. Se dice así, no como "ya lo confirmé".

**Culpar a la forma de pedir el dato cuando el costo está en el volumen.** Treinta ventanas de un día costaron lo mismo que una ventana de treinta: el trabajo era recorrer un mes de puntos por unidad, y ninguna forma de pedirlo lo cambia. Antes de rediseñar la llamada, medir la versión colapsada. Si cuesta igual, el problema es cuánto se lee, no cómo se pide.

**Medir con una fuente que el motor no usa.** El árbitro lee `evidence_points` por viaje; `telemetry_points` es otro archivo, con otra cobertura. Un cruce armado sobre el segundo responde una pregunta que nadie hizo. Antes de cruzar: buscar en el código qué lee el motor, no qué tabla suena parecido.

**Publicar un instrumento sin probarlo contra casos conocidos.** Antes de usar una prueba propia —una geometría, un cruce, una heurística— pásala por los hechos que el motor **ya selló** y cuya respuesta se conoce. Si no reproduce lo que el árbitro ya decidió, el instrumento está mal y todo lo cruzado con él también. El caso: una prueba de punto-en-polígono que reprodujo 51 de 60 llegadas selladas; las 9 que falló apuntaban todas a la misma geocerca, y ahí estaba el error.

**Creerle al nombre de una columna.** Un campo llamado `expected_geofence_id`, congelado dentro de un hecho sellado, se lee como la geocerca que el árbitro aplicó. No lo es: el motor juzga contra la geocerca **viva** del perfil y guarda ese campo por separado. Sobre esa suposición se escribió una ficha entera —"333 servicios acusados contra el destino equivocado"— y era falsa.

La lección es más fina que la anterior y por eso duele más: **el instrumento geométrico sí se había validado contra hechos sellados. Lo que no se validó fue la interpretación del campo.** Validar la medición no valida lo que se cree que la medición significa.

Cómo se atrapa: **buscar en el código quién LEE la columna**, no solo quién la escribe. Si nadie la lee, no describe nada. Y cuando el dato guardado se puede contrastar contra un hecho físico —una llegada tiene coordenadas— se contrasta antes de escribir la conclusión. Aquí bastaba probar 24 llegadas selladas contra los dos polígonos: **cero cayeron en la geocerca que el campo nombraba.**

**Contar filas que son reintentos.** Un servicio re-verificado deja varias entradas de ledger. Contar entradas en vez de servicios multiplicó por ocho el tamaño aparente de un hallazgo. Deduplicar por la cosa de la que se habla, no por la fila que la registra.

**Medir sobre datos que nadie declaró.** Datos sembrados tienen forma de datos, y un hallazgo construido sobre ellos describe la siembra, no el producto. Antes de medir: declarar de quién es cada fila y qué cuentas son de demostración. Ver [`Ficha-Diagnostico-Datos-No-Declarados`](marco-limpio/Ficha-Diagnostico-Datos-No-Declarados.md).

**Un vigilante que no ejerce el camino que puede romperse.** `/api/salud` devolvió 200 durante toda una caída de la cara cliente. No por casualidad: leía cuentas, marcas de agua y alertas **con listas explícitas de columnas**, y una lista explícita no se entera de que falte una columna que no nombra. Las pantallas usan la API relacional, que pide todas las columnas de la tabla, y ahí es donde reventaba.

**Un vigilante que no puede ver la falla es peor que no tener vigilante: da tranquilidad falsa.** La regla que queda: un sondeo de salud ejerce **la misma consulta** que sirve a las pantallas, no una parecida. Y como toda valla, no cuenta hasta **verla fallar** — se reproduce el estado roto contra la base desechable y se comprueba que se pone roja. Una puerta que nadie vio fallar es una suposición con nombre de garantía.

**Medir mal un algoritmo correcto produce evidencia falsa contra el algoritmo.** Douglas-Peucker garantiza, por construcción, que ningún punto quede a más de la tolerancia de la línea simplificada. La medición dio **102 m para una tolerancia de 8 m**, y el número se iba a publicar como "desvío máximo" de un instrumento de defensa. El algoritmo estaba bien: el medidor muestreaba cada segmento en cinco puntos en vez de calcular la perpendicular real, así que medía a un punto cualquiera de la recta y no al más cercano. Corregido, el desvío da exactamente la tolerancia.

La regla que queda: **cuando lo medido contradice una garantía del algoritmo, el sospechoso es el medidor, no el algoritmo.** Una garantía por construcción no se refuta con una corrida — se refuta con una demostración. Y la trampa es doblemente peligrosa porque el número falso era plausible y conservador: nadie discute un desvío que suena grande, y sobre él se habría decidido que la simplificación no servía.

**Ordenar por fecha sin techo devuelve el futuro. Ya pasó dos veces.** El generador crea ocurrencias por adelantado, así que cualquier consulta que ordena por `serviceDate` descendente y no acota a hoy trae servicios que todavía no ocurren. La primera vez costó una investigación entera: 1 056 ocurrencias "sin hecho" que eran de agosto y septiembre. La segunda salió en una tabla llamada **"últimos servicios" encabezada por el 1 de septiembre**, todos sin sellar, y se atrapó mirando las fechas contra el calendario — no compilando.

El patrón es siempre el mismo y por eso conviene reconocerlo de lejos: **correcto como consulta, falso como afirmación.** La consulta hizo exactamente lo que se le pidió; lo que miente es el título encima. Regla: toda consulta sobre ocurrencias lleva techo, y el techo lleva su porqué escrito al lado, para que nadie lo quite pensando que sobra.

**El fallo silencioso que devuelve de menos.** Una consulta agregada nueva reventó en el primer intento porque el controlador HTTP no sabe enlazar un `Date` en SQL crudo, y se atrapó porque la pantalla dio 500. Ese fue el modo de falla afortunado.

El mismo error puede fallar del otro lado: un `timestamptz` mal enlazado que se interpreta como un instante distinto no revienta — **filtra de más y devuelve de menos.** Entonces no hay 500 que mirar, solo una gráfica de huecos de señal con menos huecos de los que hubo, dibujada con todos los tokens correctos y perfectamente legible.

**En una pantalla de evidencia, el fallo silencioso que devuelve de menos es peor que el que revienta, porque se ve normal.** Un error visible cuesta una hora; un archivo incompleto que parece completo se defiende en una disputa. La regla que queda: cuando una consulta nueva acota por tiempo, se comprueba contra un total conocido —cuántas filas hay sin el filtro, cuántas con él— antes de creerle al número. Y si el resultado se puede contar por otro camino, se cuenta.

**El denominador de otro universo.** Si el numerador cuenta servicios contratados y el denominador cuenta la flota entera, la fracción no habla de nada. Es §D, eje del ALCANCE, y en una cifra se ve limpia: "45 de 82 unidades no cubrieron ningún servicio" era cierta en los dos números y falsa como afirmación. Cuando los dos lados vienen de universos distintos, o se cambia el denominador o se declara el alcance junto al número.

**Un conteo que el lector no puede reconstruir con lo que le enseñas debajo.** "Rutas del alcance: 27" era correcto —veintisiete registros de ruta— y no cuadraba, porque en la tabla de abajo "Finca" salía dos veces y "Km 30" tres: son rutas distintas, con trazados distintos, que comparten nombre visible. Quien lee cuenta nombres y concluye que el sistema duplica o que el conteo miente. Es §D, eje de la UNIDAD.

El arreglo no es deduplicar por nombre —eso borra rutas reales y da un número más bonito y más falso—: es contar en la unidad que las partes reconocen. Un contrato se contrata en **servicios al día**, y las rutas y turnos pasan a lectura al lado. La pregunta, antes de escribir el rótulo: **¿puede el lector reconstruir este número con lo que le voy a enseñar debajo?**

---

## Parte 2 · Candidatas al Marco — no son ley

> **Rescatadas del skill descartado, pendientes de comparar contra el Marco; si el
> Marco ya las dice, se quedan como nota; si no, se ratifican como pieza.**
>
> Mientras no se comparen, **nada se construye citándolas a ellas**: se cita el Marco,
> o se pregunta. La comparación está anotada en `DESPUES.md`, «Reglas de lo que afirma
> una pantalla, pendientes de comparar contra el Marco».

**Qué entró y qué no.** Entraron las secciones del skill que dicen qué puede afirmar
una pantalla: exactitud de números, fechas e intervalos; qué maquinaria no se enseña;
qué nombra cada cosa según lo que el árbitro selló; cuándo aparece un mapa; y la
audiencia de cada capa. **No entraron**, porque son piel o voz y las rehace el skill
nuevo: la tesis «instrumento, no tablero» y su «todo número va con su lectura», los
colores, la tipografía, los chips, los dos ritmos y las capas apagables del mapa. **Las
nueve leyes** que el skill copiaba del Marco tampoco entraron: ya viven en el Marco.

### Exactitud, no redondeo

Los tableros redondean ("~94%", "unos 7 minutos"). Los instrumentos no.

Escribe **94.2%**, **06:43:11**, **21.1%**, **7:14 min**. La precisión no es un detalle técnico: es la textura que separa medición de opinión. Un número redondeado se lee como estimación, y una estimación se discute.

**Fechas completas en evidencia.** En cualquier contexto que sirva de evidencia (expediente, bitácora, historia del sello, lectura de hechos), toda hora lleva su fecha completa: `2026-07-24 05:40`, nunca solo `05:40`. Un turno nocturno cruza la medianoche, y una hora sin fecha no sostiene un caso.

**Las duraciones se escriben como duraciones, nunca con formato de hora.** Un delta dice `10 min antes`, `2 h 14 min de retraso` — jamás `10:00 antes`, que se lee como hora del día. La regla completa: los instantes llevan fecha; los intervalos llevan unidad.

### La maquinaria de identificación no se enseña

Hay que separar dos clases de número, porque el original las confundía:

**Medición del hecho — Sí va en cara cliente.** Cobertura de la ventana, margen contra el deadline, hueco máximo de señal: son evidencia del servicio, y van junto a su umbral. Un resultado sin su medida es una acusación sin prueba.

**Maquinaria de identificación — NUNCA va en cara cliente.** Los puntajes de candidatas (`A—82 / B—39`), el razonamiento de eliminación, las unidades que se consideraron y se descartaron. Eso es cómo el motor decidió qué unidad era — y además revela la flota del carrier, así que también lo prohíbe la Ley 3 del Marco.

La distinción: **qué se midió del servicio** es evidencia; **cómo se decidió qué unidad era** es cocina. La evidencia se muestra; la cocina vive en la bitácora técnica del expediente, y del lado carrier.

### Cada cosa nombra solo lo que su evidencia sostiene

Esta regla evita inventar evidencia que el árbitro no selló.

- Un `no_cumplido` **nunca tiene unidad acreditada** — por diseño, el motor solo persiste la unidad observada cuando el veredicto salió `cumplido`. Entonces una tarjeta construida sobre `no_cumplido` **no puede nombrar unidad**.
- Los hallazgos sobre **rutas** (camino candidato, catálogo desalineado, deriva) hablan de servicios, trazos y proporciones. No necesitan nombrar unidad, y no deben.
- Los hallazgos sobre **unidades** (huecos de GPS recurrentes) sí la nombran, porque vienen de cumplidos sellados donde la unidad sí está acreditada y ahí la unidad es el sujeto.

Cuando dudes si puedes mostrar un dato: pregunta si el árbitro lo selló. Si no lo selló, no lo muestres.

#### Cuando se puede no traer el dato, no se trae

Para que un dato confidencial no llegue a una cara que no le corresponde hay dos caminos, y **no valen lo mismo**:

- **Filtrarlo** — se trae y luego se quita. Funciona hoy y se puede quitar mañana sin que nadie lo note. Un filtro es una promesa que alguien tiene que seguir cumpliendo.
- **No traerlo nunca** — la ruta que lo cargaría no existe. No hay nada que recordar, nada que revisar, nada que se pueda olvidar de correr.

**Lo segundo, siempre que se pueda.** Un filtro es la segunda mejor opción, no la normal.

El caso que lo enseña: en el expediente, los pasos `candidata` del ledger nombran cada unidad que *no* sirvió la ruta. La proyección para la cara cliente **no lee ese paso** — arma el paso de la unidad desde `decision`, que solo describe a la ganadora. La garantía no depende de que un filtro siga ahí: depende de que el dato nunca entre.

La prueba de fuego: **¿alguien podría borrar una línea y abrir la fuga sin que se rompa nada?** Si la respuesta es sí, todavía es un filtro. Si la línea que habría que borrar no existe, ya es estructura.

Vale igual para las capas de mapa con audiencia declarada: la capa que no le toca a esa cara **no se construye**, no se construye apagada.

#### Lo inferido no se presenta como declarado

Identificar qué unidad cubrió una ruta es una **inferencia que acumula confianza**, no un dato
que alguien declaró. Mientras el turno corre, esa asociación se está formando.

- **En vivo:** la unidad se marca `probable`, con la etiqueta visible junto al identificador.
  La pantalla declara además, en una línea: *"el sistema infiere qué unidad cubre cada ruta a
  partir de su recorrido; se confirma al cierre"*.
- **Al cierre:** la unidad pasa a `confirmada`, congelada junto con el resultado.

Escribir "U-208" a secas en la torre afirma como hecho algo que el motor todavía está
resolviendo. Es la misma falta que pintar un veredicto antes del cierre.

#### Llegar es un hecho medido; cumplir es un veredicto

Cuando una unidad entra a la geocerca, eso **se puede afirmar**: se midió. Pero no es un
resultado — el resultado necesita el deadline, la cobertura y el cierre.

Por eso la etiqueta de llegada en vivo dice **"Llegó 14:06" y va en acero**, nunca en verde ni
con la palabra "cumplido". El verde llega al cierre, o no llega.

#### El instrumento no dice más de lo que ve, y lo dice cuando no ve

Si una unidad lleva veinte minutos sin señal, su llegada estimada se muestra como `—`, no como
una hora calculada sobre datos viejos. **Un hueco declarado vale más que un número inventado.**

### El mapa solo aparece cuando lo que muestra es confiable

Un mapa comunica "esto es lo que está pasando ahora". Cuando eso deja de ser cierto, el mapa
miente aunque cada píxel sea correcto.

- **Con operación en curso:** mapa completo, unidades sobre sus rutas.
- **Sin turno activo:** mapa **quieto** — ciudad, geocerca del destino, rutas del siguiente turno
  insinuadas. Da continuidad y anticipa lo que viene, con su etiqueta: *"sin unidades en ruta"*.
- **Cuenta nueva:** **sin mapa.** No hay geocercas ni rutas que dibujar; el espacio lo ocupa el
  camino a la primera verificación.
- **Sistema sin señal:** **sin mapa, ni siquiera con la última posición conocida.** Un camión
  dibujado cerca de la planta se lee como "va llegando" aunque el dato sea de hace dos horas.
  La ausencia del mapa es la declaración más honesta de que no hay nada que ver.

La pantalla conserva su estructura en los cuatro casos: lo que cambia es qué ocupa el lugar del
mapa, no el esqueleto de la vista.

### Audiencia declarada por capa (ley del Marco, no preferencia)

**Cada capa declara su audiencia: carrier · planta · corporativo · J-Staff.**

Un mapa por capas apagables es un multiplicador de riesgo de confidencialidad: si las capas se prenden y apagan, tarde o temprano alguien prende una capa de carrier en una vista de planta. El Marco es tajante — el cliente jamás ve la operación interna del carrier, y el trazo se corta en la llegada.

- **La audiencia la hace cumplir el código, no el diseño.** No es un filtro visual ni una decisión de quien arma la pantalla: la capa no existe para quien no le corresponde.
- **Una capa sin audiencia declarada no se construye.**
- Ejemplo: kilómetro muerto es capa de carrier y solo de carrier. Recorrido posterior a la geocerca no es capa de nadie del lado cliente.
