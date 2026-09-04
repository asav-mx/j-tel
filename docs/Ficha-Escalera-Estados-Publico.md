# Ficha — La escalera de estados de la app pública

**Fecha: 27 de agosto de 2026.** Cara pública del transporte concesionado (app
del pasajero). Frente: Tramo JB. Migración: `0031_estados_publico`.

---

## El defecto, en una frase

**La app promete cadencia donde no hay servicio.**

Se detectó en la vista previa del Corredor de prueba, sin una sola unidad
recorriéndolo: la pantalla decía *«Cada 20 min · El servicio de esta ruta corre
cada 20 minutos. Verás el tiempo exacto en cuanto haya ubicación»*.

Las dos mitades de esa frase eran falsas al mismo tiempo, y por razones
distintas. **Ninguna unidad estaba corriendo esa ruta**, así que no había
servicio del cual prometer cadencia. Y **nadie había declarado esos 20
minutos**: eran el `DEFAULT` de una columna, dicho en voz alta con la autoridad
del sistema detrás.

## Por qué existía

La caída a «frecuencia declarada» se diseñó para un caso real y bien resuelto:
**hay servicio, pero calló el GPS.** Ahí decirle al pasajero que se guíe por la
frecuencia es exactamente lo correcto.

El 27 de agosto, temprano, se colapsaron tres causas en ese único modo —sin
conexión, fuera de horario, sin unidades con posición— con un argumento que
sigue siendo bueno: *la app no le cuenta al pasajero de quién es la culpa*.

**Resolvió de más.** «Por horario» no es un silencio: es una afirmación. Y se
estaba diciendo también cuando la ruta estaba cerrada y cuando no había un solo
camión operando. Es la sección E del Marco —completar un hueco porque la
pantalla se ve mejor completa— con el agravante de que aquí lo completado es una
promesa operativa.

La lección, que es la que conviene guardar: **colapsar por «al usuario le da
igual» es correcto cuando las causas comparten consecuencia, y falso cuando no.**
Sin conexión y sin servicio le dan igual al pasajero en cuanto a culpa, y no le
dan igual en cuanto a qué hacer con su tarde.

---

## La escalera

El endpoint resuelve el estado de cada circuito evaluando en orden y **parando
en el primero que aplique**. Vive en `estadoDelCircuito`
(`packages/domain/src/publico.ts`), pura y probada aparte.

| # | Estado | Cuándo | Qué dice la app |
|---|---|---|---|
| 1 | `fuera_de_horario` | el reloj está fuera del horario declarado del circuito | a qué hora abre. Ni frecuencia ni tiempos |
| 2 | `en_vivo` | hay al menos una unidad **fresca** y **dentro del corredor** | el rango de llegada (si el interruptor está prendido) |
| 3 | `por_horario` | ninguna fresca, pero alguna se vio **en el corredor** dentro de la ventana de confianza | la frecuencia declarada — y si no hay, que el servicio corre, sin tiempo |
| 4 | `sin_servicio` | ninguna de las anteriores | que ahorita no hay unidades en servicio. No promete nada |

### Las reglas duras, y por qué cada una

**La asignación vigente es plan, no evidencia.** Un circuito con cinco unidades
asignadas y ninguna observación reciente cae a `sin_evidencia`, **nunca** a
`por_horario`. La asignación dice qué se planeó; sólo el GPS puede afirmar que
hay servicio.

Esto se cuidó en la forma del código, no sólo en la lógica:
`estadoDelCircuito` **no recibe** cuántas unidades hay asignadas. No tenerlo a
la mano es lo que impide usarlo por descuido.

**Los dos estados con evidencia exigen corredor.** El caso que decidió la regla
es el **camión del patio**: reporta cada minuto y, sin esta condición,
mantendría la ruta en `por_horario` toda la noche prometiendo una cadencia que
nadie está dando. Su última posición está en el patio, así que no cuenta.

El caso simétrico es el **túnel**: la última vez que se le vio iba en la ruta,
así que sí cuenta. La ventana de confianza es exactamente eso — cuánto tiempo
después de verla en la ruta se puede seguir afirmando que hay servicio.

**Sin frecuencia declarada, el estado 3 no inventa cadencia.** Dice que el
servicio está corriendo y se calla el número.

**El motor mide y reporta.** Ninguno de estos estados se guarda como hecho ni
genera veredicto. El sprint público reporta, no sella.

---

## Lo que se volvió configuración

Nada de esto vive en el código. Todo es columna de `circuits`, y los valores por
defecto viven en la migración.

| Perilla | Columna | Default | Qué contesta |
|---|---|---|---|
| Horario de servicio | `service_start_local` · `service_end_local` · `time_zone` | 05:00 · 23:00 · Cd. Juárez | cuándo está abierto |
| Frecuencia declarada | `declared_frequency_minutes` | **ninguno — nullable** | cada cuánto pasa, *si el concesionario lo declaró* |
| Frescura (estado 2) | `stale_after_seconds` | 180 | hasta cuándo una posición dice dónde está el camión |
| Ventana de confianza (estado 3) | `service_confidence_minutes` | **15** | hasta cuándo se puede afirmar que hay servicio |
| Tolerancia de corredor | `corridor_tolerance_meters` | 150 | a qué distancia deja de poderse afirmar que va en la ruta |
| Interruptor del rango | `arrival_range_enabled_at` | **NULL (apagado)** | si además se le cree el minuto estimado |

### La frecuencia perdió su default, y es el corazón del arreglo

Era `INTEGER NOT NULL DEFAULT 20`. Con eso, **«declaró 20» y «no declaró nada»
eran indistinguibles en la base** — y la app afirmaba la cadencia igual en los
dos casos.

La migración deja los dos circuitos existentes en `NULL`, y es la respuesta
honesta: el del corredor de laboratorio nunca se declaró, y Oasis–Centro está
anotado como pendiente de confirmar con el concesionario. *Si no se puede
distinguir declarado de heredado, no está declarado.*

El default duplicado del alta —`numero("frecuenciaMin", 20)`— también se quitó.
Las otras perillas conservan el suyo, y la diferencia tiene razón: **son
umbrales del instrumento, y heredarlos no afirma nada de cara al pasajero.** La
frecuencia sí: la app la dice en voz alta.

### La ventana de confianza no se deriva de la frecuencia

Se propuso `2 × frecuencia`. Se descartó por tres razones, y la tercera es la
de fondo:

1. La frecuencia ahora puede ser `NULL`, así que la fórmula se queda sin insumo
   justo en el caso que la motiva.
2. Con el default de 20, todo circuito heredaría 40 minutos que nadie eligió.
3. **Derivarla acopla dos perillas que significan cosas distintas.** Quien
   afinara la frecuencia porque al concesionario le cambió el horario estaría
   moviendo sin saberlo cuánto tiempo la app sigue afirmando que hay servicio.

Los 15 minutos son un punto de partida declarado, no una medición. Se afinan con
la prueba de campo.

---

## El interruptor del rango

Bandera por circuito, hermana del interruptor de publicación, **apagada por
defecto**. Marca de tiempo y no booleano, por la misma razón que `published_at`:
«desde cuándo» sale gratis y encaja con el resto del modelo, donde la vigencia
se guarda en vez de deducirse.

**Por qué existe.** Un circuito recién dado de alta arranca con `avg_speed_kmh`
en una mediana medida sobre **otra** flota. Enseñar un minuto estimado con esa
velocidad es presentar una suposición como medición.

**Qué hace apagado.** El estado `en_vivo` sigue enseñando el camión moviéndose
en el mapa —verdad observada— y se calla el minuto estimado. No esconde el
circuito ni las unidades: sólo el número.

Se prende desde la pantalla del circuito en J-Staff, junto al de publicación,
cuando la velocidad ya se calibró contra la calle.

---

## Dos arreglos que salieron de la lectura previa

**`CORREDOR_METROS = 150` clavado en `vista-pasajero.tsx`.** El servidor cortaba
con `corridor_tolerance_meters` de la base y el teléfono calculaba llegadas con
un 150 escrito en el código. Coincidían **por casualidad**. El día que alguien
moviera la columna, el servidor publicaría un camión que el teléfono descartaría
para el rango, sin que nada lo dijera. Es la misma divergencia silenciosa que ya
costó caro cuando la geocerca congelada en el hecho y la que usaba el motor para
juzgar se separaron. Ahora la tolerancia viaja en la forma.

**`LLAVE_TEMA = "jb-tema"`.** «jb» es Juárez Bus horneado en una llave de
almacenamiento. Pasó a `jtel-tema`: el código no conoce nombres de
concesionarios.

---

---

## La corrección del 28 de agosto — el cuarto estado emitía un veredicto

El estado se llamaba `sin_servicio` y la app decía *«Ahorita no hay unidades en
servicio en esta ruta»*. **Las dos cosas estaban mal, y por la misma razón: se
trajo la lógica del árbitro a donde no toca.**

En transporte especial el silencio es prueba en contra —sin evidencia no hay
cumplimiento, porque de eso depende un pago—. En transporte público es al revés:
la unidad está declarada en la concesión y el horario también, y eso no es una
suposición nuestra sino **un hecho que el propio operador publicó**. Que nosotros
no veamos una posición no autoriza a afirmar que no hay servicio. El pasajero no
está juzgando a nadie.

Y la redacción tenía algo peor: *«no hay unidades en servicio»* le contaba al
pasajero que **nuestra telemetría falló**, y eso expone al operador. La app no
expone al operador nunca. Esa falla es una alerta operativa y su lugar es el
centro de control del carrier — otro frente, no la cara pública.

**Lo que cambió, exactamente:**

| | Antes | Ahora |
|---|---|---|
| Nombre del estado | `sin_servicio` | `sin_evidencia` |
| Titular, con frecuencia | «Sin servicio» | «Cada N min» |
| Titular, sin frecuencia | «Sin servicio» | el horario declarado |
| Frase | «Ahorita no hay unidades en servicio en esta ruta» | «Servicio declarado de 05:00 a 23:00» — y **nada** cuando el titular ya es el horario |
| Rótulo | (no había) | «Horario / Frecuencia declarada por el concesionario» |

**Fuera de horario sí se afirma**, y no cambió: eso se lee de la configuración,
no se infiere de un silencio.

### El camión con dato viejo se queda en el mapa

Antes desaparecía. El argumento era que la última posición conocida «se lee como
va llegando», y **estaba mal planteado**: lo que se lee así es un punto pintado
*como si fuera de ahorita*, no el hecho de que exista. Un camión que perdió señal
no se fue a ningún lado —sigue su recorrido— y borrarlo manda al pasajero
caminando a otra ruta más lejos por algo que no ocurrió.

Ahora va, **apagado, más chico y con «hace N min» al lado**. Tres señales para lo
mismo, porque el color solo no lo ve quien trae el teléfono al sol.

**La línea no está en si el camión se ve, sino en si se ve como si fuera de
ahorita.** Por eso el RANGO sí desaparece con el dato viejo: calcularlo desde una
posición vieja es inventar un número, y lo paga la persona parada en la banqueta.

Al agotarse la ventana de confianza el punto sí se va: a esas alturas ya no se
puede sostener que la unidad siga en la ruta.

### Lo que esto le costó al contrato

`fresco` **dejó de ser siempre `true`**. Era un campo que sólo confirmaba lo que
el filtro ya garantizaba; ahora decide si la app pinta la unidad encendida y la
usa para el rango, o apagada y sólo como «por aquí se le vio». Se resuelve en el
servidor porque el umbral es del circuito y el teléfono no lo conoce.

---

## Una decisión que tomé y no estaba en el encargo

**`sin_conexion` es un quinto modo, del lado del teléfono.**

La escalera tiene cuatro estados porque son los que el *servidor* puede
resolver. Cuando el teléfono no logra respuesta, no sabe nada del servicio — y
ahí no sirve ninguna de las cuatro copias: «sin servicio» **afirma** que no lo
hay, y «por horario» **promete** una cadencia sin evidencia. Sería el mismo
error de este arreglo, visto desde el otro lado.

Así que la falta de conexión dice que no se pudo consultar. No culpa al
operador —sólo describe lo que pasó del lado del teléfono— y no promete nada.

---

## Verificación

- **157/157** en `@jtel/domain`, con 11 pruebas nuevas de la escalera. El camión
  del patio y el túnel tienen la suya, con su nombre.
- **33/33** en `@jtel/publico`, con 8 nuevas del endpoint: los cuatro estados,
  la ventana por circuito, la frecuencia nula, el interruptor del rango y la
  asignación-que-no-es-evidencia.
- **75/75** de integración contra la rama desechable, con la `0031` aplicada
  ahí, incluidas las de los dos CHECK y la de que un circuito nuevo **nace sin
  frecuencia**.
- Typecheck limpio en `@jtel/publico`, `@jtel/db` y `@jtel/web`.
- Revisión en navegador, con teléfono simulado, de los estados alcanzables con
  los datos reales de hoy.
- **28 de agosto:** `sin_evidencia` revisado en el navegador contra producción.
  Mirarlo encontró un defecto que ninguna prueba vio: el titular decía «05:00 a
  23:00» y la frase de abajo repetía «servicio de 05:00 a 23:00» — la misma
  falta que se acababa de corregir en el rótulo, ahora entre titular y frase.

## Lo que esta ficha NO afirma

Que los 15 minutos de la ventana de confianza sean el número correcto. Es un
punto de partida declarado; sale de la prueba de campo de los días 11–13.

Y que la escalera se haya visto en los cuatro estados contra producción. Los
que dependen de que un camión esté en el corredor sólo ocurren en las horas de
turno —05:00 a 06:00 y 14:00 a 16:00 en el corredor de laboratorio— y fuera de
esas horas no hay cómo alcanzarlos sin inventar una posición.

---

## La corrección del 2 de septiembre — el interruptor gobernaba el titular y nada más

El interruptor del rango se construyó el 27 de agosto para callar una sola
cosa: el minuto estimado, mientras la velocidad del circuito siga siendo la
mediana medida sobre **otra** flota. La condición se escribió una vez,
`conRango`, y se puso donde se veía el defecto — el titular.

**De los cinco lugares de la app que pueden afirmar un tiempo, cuatro no la
tenían.** Ninguna prueba lo vio, y no por descuido de las pruebas: no había
ningún valor equivocado que comparar. La condición faltaba en el sitio de
llamada, que es exactamente donde el Marco §D dice que ninguna prueba sobre una
función pura alcanza.

### Las cuatro fugas

| | Qué salía | Qué lo gobernaba | Por qué era falso |
|---|---|---|---|
| **1** | «llegando» y «N–M min» en cada renglón del hilo de paradas | sólo el modo (`porHorario`), nunca el interruptor | El titular decía «3 en ruta» y tres centímetros abajo la lista daba los minutos que el titular se acababa de callar. Y **sin pedir la ubicación del pasajero**: el hilo mide parada-contra-camión, así que salía para cualquiera que abriera la app |
| **2** | los mismos minutos, calculados **desde camiones con dato viejo** | nada — `camiones` era un `number[]` de puros avances y tiraba el `fresco` de cada unidad | **Éste sobrevivía a encender el rango**, y es el más grave por eso. El mapa pintaba el camión gris con «hace 4 min» y el hilo, con ese mismo camión, daba un estimado. La app se contradecía a sí misma en la misma pantalla |
| **3** | el **verde** de «Llegando» sobre el titular | `proxima?.llegando && !porHorario` — sin el interruptor | Con el rango apagado ese número es el **conteo de unidades**. O sea el verde no sólo afirmaba lo que la palabra ya había callado: le prestaba el significado a un dato que no era el suyo |
| **4** | «Verás el tiempo exacto en cuanto haya ubicación», en POR HORARIO | nada | Una promesa en futuro es una afirmación de tiempo. Con el interruptor apagado el pasajero da su ubicación, el circuito pasa a vivo, y lo que aparece es «3 en ruta». Prometer un número que el circuito no está autorizado a dar es la misma falta que darlo, con un rato de retraso |

### Por qué eran cuatro y no una

Las dos condiciones que autorizan a decir un minuto —el interruptor del
circuito y la frescura de esa posición— **vivían separadas y lejos una de
otra**. La frescura se filtraba arriba, al armar las llegadas del titular; el
interruptor se comprobaba abajo, al pintar. Cada sitio nuevo que quisiera dar un
tiempo tenía que acordarse de las dos, por su cuenta, sin nada que se lo
recordara.

La disciplina ya se probó y falló: **cuatro de cinco**. Por eso el arreglo no
fue agregar la condición en cuatro lugares más — eso es acordarse otra vez.

### La valla: el permiso

`rangoDeLlegada` dejó de recibir una velocidad suelta y ahora exige un
`PermisoDeRango` (`packages/domain/src/llegada.ts`). El permiso lleva la
velocidad **adentro**, y sale de una sola fábrica, `permisoDeRango`, que aplica
las dos condiciones de una vez y devuelve `null` si alguna falta. La marca es un
`unique symbol`, así que ningún literal puede escribirlo.

Es la misma forma de defensa que este tramo ya usó dos veces: `estadoDelCircuito`
**no recibe** cuántas unidades hay asignadas, y `fresco` se resuelve en el
servidor. No tener el dato a la mano es lo que impide usarlo por descuido.

**Y es demostrable, que es la condición con la que se aceptó.** Tres directivas
`@ts-expect-error` en `llegada.test.ts` exigen que las tres formas de fabricar un
minuto sin permiso **no compilen**: la velocidad suelta, el permiso construido a
mano, y el permiso sin descartar su `null`. La directiva se queja cuando **deja
de hacer falta**: aflojar la firma o la marca hace que `tsc` falle con *«Unused
'@ts-expect-error' directive»*. Se comprobó rompiéndola a propósito en las dos
direcciones — ensanchar la firma tumba dos directivas, quitar la marca tumba la
tercera — y restaurándola.

Las tres funciones de la valla **se declaran y nunca se llaman**, a propósito:
una llamada ilegal no produce un valor equivocado que comparar, produce un error
de compilación. Quien las comprueba es `tsc`, no vitest. Al lado va un control
positivo que sí corre, porque sin él un rename de la función dejaría las tres
directivas «usadas» por el error equivocado y la valla pasaría sin comprobar
nada.

### La lección, para el siguiente que agregue un apagador

**Un apagador no se pone donde se ve el defecto: se enumera completo.** Una
afirmación viaja en más de un portador —la cifra, la palabra, el color, el
tamaño, la animación, el ícono, y la promesa en futuro— y apagar uno deja a los
demás afirmando solos.

Y el color es el que se olvida. **Ésta es la tercera vez que un color afirma lo
que la palabra ya calló:**

1. **Marco §D, caso 4** — el motivo «temprano» pintado en ámbar. La medición era
   correcta y el texto no acusaba a nadie; el ámbar le imputaba al carrier un
   cargo que el contrato no le pone.
2. **#359** — el punto de estado se quedó **verde** junto a «Sin servicio». El
   CSS colgaba de `[data-modo="horario"]`, un valor que ese mismo PR había
   eliminado, así que la regla de color dejó de aplicar mientras la frase sí
   cambió. Se arregló colgándolo de `:not([data-modo="en_vivo"])` y **no de una
   lista de estados**, justo para que el siguiente estado no se pintara vivo por
   olvido.
3. **Ésta** — el verde de «Llegando» sobre un titular que ya no dice «Llegando».

Las tres tienen la misma forma: **la condición del texto se actualizó y la del
color no**, porque viven en archivos distintos y se leen en momentos distintos.
La regla que sale de las tres: cuando una condición apaga una afirmación, el
color no lleva su propia copia de esa condición — cuelga del mismo dato que el
texto, o del estado que ya lo resume. Aquí se resolvió sin tocar el CSS ni la
condición del JSX: `proxima` no puede existir sin permiso, así que el verde se
quedó sin de dónde encenderse.

### La revisión visual, y cómo se montó

Las cuatro fugas se vieron en el navegador, con teléfono simulado a 390×844, en
los dos temas. **Antes y después**, contra el mismo escenario — porque una
revisión que no puede enseñar el defecto vivo no prueba que lo arregló.

El escenario no se esperó a la calle. Vive en la **rama desechable**, con dos
unidades del circuito a la vez:

- una **fresca** en el corredor, avance ~944 m
- una **vieja** en el corredor, avance ~1 800 m, con 6 minutos de dato

y la vieja va **delante** de la fresca, más cerca de dos paradas. Eso es el
corazón del montaje: si la vieja fuera detrás, el arreglo no cambiaría nada
visible y la revisión pasaría en vacío.

**Por qué un escenario y no la calle.** La fuga 2 pide un camión que pierda
señal justo entre 3 y 15 minutos **estando dentro del corredor**. Eso no se
agenda: hay que esperar a que un aparato real falle el rato exacto. Y el §F ya
escribió el permiso — lo prohibido es que una afirmación no medida le llegue a
alguien, y aquí no hay receptor: rama desechable, lo mira quien lo sembró, y se
borra al terminar. El guion se negaba a correr si la URL no era la de
`DATABASE_URL_TEST`, misma forma que `escenario-dos-carriers`.

Lo que enseñó, con el rango **apagado** y el circuito en vivo:

| | Antes | Después |
|---|---|---|
| Rótulo | «En vivo · sin tiempo estimado» | igual |
| Mercado | `llegando` | *(vacío)* |
| Hospital | `llegando` ← **del camión de hace 6 min** | *(vacío)* |
| Plaza de Armas | `0–7 min` | *(vacío)* |
| Terminal Norte | `4–11 min` | *(vacío)* |

La contradicción se leía **en una sola pantalla**: el rótulo decía «sin tiempo
estimado» y tres centímetros abajo la lista daba cuatro tiempos.

Y con el rango **prendido**, que es donde vivía la fuga que sobrevivía al
interruptor:

| | Antes | Después |
|---|---|---|
| Titular | `0–7 min` (del camión fresco) | igual |
| Hospital, donde está parado el pasajero | `llegando` ← **del camión de hace 6 min** | `0–7 min` |
| Plaza de Armas | `0–7 min` | `3–10 min` |
| Terminal Norte | `4–11 min` | `7–14 min` |

Después del arreglo, **la parada donde está el pasajero dice el mismo número
que el titular**, porque los dos leen del mismo camión. Antes se contradecían.

**Dos regresiones comprobadas aparte**, porque el arreglo podía haberlas roto:

- Los **dos** camiones se siguen dibujando en el mapa, y sólo el viejo lleva su
  pastilla «hace 6 min». Filtrar quién puede afirmar un tiempo no es borrar del
  mapa a quien perdió señal — eso rompería la decisión del #360.
- En POR HORARIO **con el interruptor prendido** la promesa se conserva
  («…Verás el tiempo exacto en cuanto haya ubicación»); apagado, desaparece.

El tema oscuro se comprobó leyendo el **fondo rendido** (`rgb(20,18,37)`), no el
tema pedido: headless arranca en claro, y una corrida que cree haber rendido el
oscuro no prueba nada. Desbordamiento horizontal: 0 en todas las corridas.

Al terminar, el escenario se borró: el endpoint contesta `404` y «No existe ese
circuito» — lo mismo que para un slug inventado.

---

## La corrección del 3 de septiembre — el escalón del arranque

**Migración: `0032_fecha_arranque`.** Un circuito sólo podía estar en dos
estados: **invisible** —sin publicar— o **presentado como si operara**. Faltaba
el de en medio, que es el que más falta hace las semanas antes de un arranque:
declarado y visible, con el servicio sin empezar.

El título de esta ficha perdió el «cuatro» por lo mismo que se corrige aquí: un
número en un rótulo es una afirmación, y ésa acaba de dejar de ser cierta.

### Qué estaba pasando

Un circuito publicado tres semanas antes de su primer día caía a
`sin_evidencia`, y la app le decía al pasajero el horario declarado con el
rótulo de siempre. La frase no era falsa —nadie prometía cadencia— pero la
pantalla **contaba una ausencia que no significa nada**: no hay unidades porque
todavía no las tiene que haber. «No hemos visto camiones» describe un
instrumento mirando un mundo donde aún no hay nada que mirar.

Adentro era peor, porque adentro sí se enunciaba como carencia:

| Pantalla | Qué decía tres semanas antes del arranque |
|---|---|
| Operar | `0 de 5` en ruta, y las cinco unidades en la caja ámbar de «qué necesita atención», cada una con «no ha salido» |
| Reporte | `0 vueltas observadas`, `con señal 0 de 5`, y «no se puede medir el intervalo todavía» |

Las seis cifras eran correctas y las seis mentían igual: **§D en su forma de
alcance.** Cada una vale para una jornada que ocurrió, y ninguna jornada había
ocurrido. «No ha salido» es lo más caro de los seis, porque es lo único de esas
pantallas que se lee como reproche — y se lo hacía a un transportista por no
estar trabajando antes de que existiera el trabajo.

### El escalón, y por qué va hasta arriba

`por_arrancar` se evalúa **antes que `fuera_de_horario`**: la fecha manda sobre
el reloj. Preguntarle al horario si está abierto un servicio que no ha arrancado
es preguntar por la puerta de algo que todavía no existe — y produciría «Abre
05:00» un día 3 a las cuatro de la mañana, que invita a ir a la parada.

| # | Estado | Cuándo |
|---|---|---|
| **1** | **`por_arrancar`** | **la fecha declarada todavía no llega** |
| 2 | `fuera_de_horario` | el reloj está fuera del horario |
| 3 | `en_vivo` | alguna unidad fresca y dentro del corredor |
| 4 | `por_horario` | se vio alguna en el corredor dentro de la ventana de confianza |
| 5 | `sin_evidencia` | ninguna de las anteriores |

Pasada la fecha, la escalera trabaja exactamente igual que antes de que este
escalón existiera. Es lo que fija una prueba, con ese nombre.

### La valla: `estadoDelCircuito` EXIGE el dato

`estadoDelCircuito` no ganó un parámetro opcional: ganó uno **requerido**,
`yaArranco`. Los dos sitios de llamada —el endpoint del pasajero y Operar—
dejaron de compilar hasta que cada uno decidió qué pasarle. Es la misma forma de
defensa que este tramo ya usó tres veces: la función **no recibe** cuántas
unidades hay asignadas, `fresco` se resuelve en el servidor, y `rangoDeLlegada`
exige un `PermisoDeRango`. Un booleano con default habría dejado que la segunda
cara se enterara del escalón en producción.

La comparación vive en una sola función pura, `yaArrancoElServicio`, y **es de
día civil en la zona del circuito**, no de instantes: el servicio arranca a las
00:00 de donde corre. Construir un instante obligaría a inventar una hora de
arranque que nadie declaró — lo que se declara es el día.

### Por qué la columna NO se llama `service_start_date`

Ésta es la decisión que hay que dejar escrita con su razón, no sólo con su
resultado.

Ya existe `service_start_local`, que es **la hora a la que el circuito abre cada
día**. Una columna hermana —`service_start_date`— habría dejado dos campos
contiguos, casi idénticos de leer, con significados distintos: uno es la hora de
apertura diaria, el otro el día en que el servicio existe por primera vez.

No es una hipótesis. **Es exactamente lo que ya pasó en esta misma tabla con las
dos «tolerancias»**: el formulario llamaba «Tolerancia» al pegado de paradas
(25 m) mientras la del corredor (150 m) —la que decide qué unidad ve el
pasajero— no tenía ni editor. Quien buscaba «la tolerancia» encontraba la que no
era, y la movía. Se arregló separando los nombres para que cada uno dijera qué
hace su número.

`service_launch_date` está lo bastante lejos de `service_start_local` como para
que no se confundan al leerlas en una lista de columnas ni al teclear un
autocompletado. En la piel, en las dos caras y sin excepción, se llama
**«arranque del servicio»**.

La regla general que sale de las dos veces: **dos columnas que comparten prefijo
se leen como variantes de la misma cosa.** Si no lo son, el prefijo es una
afirmación falsa escrita en el esquema, y la paga quien mueva la que no era.

### Sin default, y aquí el default habría sido peor que en la frecuencia

`NULL` significa **ya opera**, nunca «arranca hoy». La columna no tiene valor de
origen y tampoco está en `ORIGEN_DEL_CIRCUITO`, por la razón de la `0031`: la
app dice esta fecha en voz alta, así que tiene que venir del concesionario.

Y hay un agravante propio. El default más «natural» —la fecha de hoy— no sólo
fabricaría una declaración que nadie hizo: **apagaría el servicio de todo
circuito existente hasta la medianoche**. Un valor de origen que cambia el
comportamiento del sistema no es un punto de partida, es un interruptor
escondido.

Por eso la frase que acompaña al campo en el expediente dice, con todas sus
letras, que vacío significa que ya opera. Un campo de fecha en blanco se lee
como un pendiente, y aquí significa lo contrario.

### Lo que ve el pasajero

Con la fecha en el futuro, el endpoint **contesta antes de consultar
posiciones**, igual que fuera de horario. No es ahorro: una unidad probando el
recorrido la semana antes reporta como cualquier otra, y publicarla convertiría
un ensayo en un servicio. Tiene su prueba, «el camión del ensayo», hermana de
«el camión del patio».

El recorrido y las paradas se siguen viendo — bajan del endpoint de la FORMA,
que no depende de esto:

| | Qué dice |
|---|---|
| Titular | `Arranca 15 sep` — corto, para rimar con el `Abre 05:00` de fuera de horario |
| Frase | «El servicio de esta ruta arranca el martes 15 de septiembre, de 05:00 a 20:00.» |
| Rótulo | «Arranque declarado por el concesionario» |

**La frecuencia se agrega sólo si el concesionario la declaró**, y el caso que
va a salir en el arranque real es el que no la trae: la frase se cierra en el
horario y no inventa una cadencia para llenar el renglón. Es la misma regla de
la `0031`, aplicada a un estado nuevo.

**El color no hizo falta tocarlo, y conviene decir por qué.** El punto de estado
y el atenuado de la tarjeta cuelgan de `:not([data-modo="en_vivo"])` desde el
#359 — colgados de una lista de estados, este modo nuevo se habría pintado vivo
por omisión. Es la cuarta vez que esa decisión paga sola.

### Adentro, el ruido apagado

- **Operar**: el número grande cede el lugar a `Arranca el martes 15 de
  septiembre` y a cuántas unidades tiene asignadas, con la misma forma que ya
  usaba el circuito cerrado. Toda unidad del plan cae en la situación nueva
  `por_arrancar`, así que **la caja ámbar de atención queda vacía** — y eso es
  lo que se prueba, no el rótulo.
- **Reporte**: la pantalla se reemplaza entera, no se le pone un aviso encima.
  Dejar las secciones con sus ceros y un letrero arriba sería §D en su forma de
  agrupación: los ceros seguirían leyéndose como mediciones de una jornada que
  no ocurrió, y el letrero no los desmiente — los acompaña. Corta **antes** de
  leer el historial: preguntarle al archivo por una jornada que no empezó no
  tiene respuesta.
- **Expediente**: campo de fecha en «Lo que el concesionario declara», con su
  frase de efecto —hermana de `loQueDiraLaApp`— y con las tres lecturas
  separadas: sin fecha, con fecha futura, y **el día mismo**, que es el borde
  donde una copia se equivoca sola. En «cómo va armado» entra como `decidido`,
  nunca como `falta`, por lo mismo que la frecuencia.

### Dos defectos que encontró escribir las pruebas

**`Date.UTC` no rechaza un día imposible: lo desborda.** `2026-13-45` no da
error — da el 14 de febrero de 2027, una fecha perfectamente creíble que nadie
declaró. Lo cazó la prueba de «una fecha ilegible no produce un titular
inventado». La comprobación quedó de ida y vuelta —si el día que sale no es el
que entró, no era una fecha— y está en los dos lados: en el formateador del
teléfono y en el `POST` que guarda, porque el `<input type="date">` del
navegador no es la última palabra sobre lo que entra a la base.

**El día del arranque no se lee como instante.** `new Date("2026-09-15")` es
medianoche UTC y en Juárez se dibuja como el **14**. Un día corrido por uno
manda a alguien a la parada la víspera, y en la pantalla no hay nada que se vea
mal. Las dos funciones que lo escriben arman la fecha a mediodía UTC y tienen su
prueba con ese nombre.

### Una decisión que tomé y no estaba en el encargo

**El buscador «¿a dónde vas?» no dice nada del arranque.** Contesta si una ruta
le sirve al pasajero *geográficamente*, y eso es cierto antes y después del
primer día; al abrirla, la pantalla del circuito ya se lo dice. Meterlo también
ahí habría sido repetir la misma afirmación en dos lugares que se actualizan por
separado — que es el arreglo del #366 al revés.

Queda escrito para que sea decisión y no olvido. Si la prueba de campo enseña
que alguien llega a la parada por el buscador sin haber abierto la ruta, ahí se
revisa.

### Lo que esta sección NO afirma

Que se haya visto un arranque real. La fecha del primer circuito la captura el
concesionario, y hasta que eso pase lo único que hay es el estado alcanzado a
propósito en la rama desechable.

---

## La corrección del 4 de septiembre — el rótulo repetía el titular

**Sin migración.** Cambio de redacción en el renglón chico del pie de la
tarjeta, y una regla que se deja escrita porque es la tercera vez que esta
pantalla la infringe.

### La regla

> **El rótulo dice DE DÓNDE SALE la afirmación. Nunca repite QUÉ ES.**

Qué es ya lo dijeron el titular y la frase, cada uno con su lugar y su tamaño.
Un rótulo que lo vuelve a decir **gasta el único renglón que quedaba** para lo
que nadie más está diciendo: quién responde por lo que se está afirmando.

### Lo que se veía

Con el titular en «05:00 a 23:00», el rótulo decía «Horario declarado por el
concesionario». La palabra «horario» era la misma de arriba, y lo único que ese
renglón agregaba —la atribución— venía enterrado detrás de ella.

| Estado | Titular | Rótulo, antes | Rótulo, ahora |
|---|---|---|---|
| `por_arrancar` | `Arranca 15 sep` | «**Arranque** declarado por el concesionario» | «Según el concesionario» |
| `fuera_de_horario` | `Abre 05:00` | «**Fuera de horario**» | «Según el concesionario» |
| `sin_evidencia`, con frecuencia | `Cada 20 min` | «**Frecuencia** declarada por el concesionario» | «Según el concesionario» |
| `sin_evidencia`, sin frecuencia | `05:00 a 23:00` | «**Horario** declarado por el concesionario» | «Según el concesionario» |
| `por_horario` | `Cada 20 min` | «**Por horario**» — nombraba el modo | «Según el concesionario» |

Es la misma falta que ya se corrigió dos veces en esta pantalla —entre el
titular y la frase el 28 de agosto, y entre el titular y el hilo de paradas en
el #366—, y las tres se vieron **mirando**, nunca compilando.

### La atribución NO se quita, y ésa es la otra mitad

Acortar no es callar de dónde viene. **Sin el «según el concesionario», la app
afirma el horario con su propia autoridad** — y nosotros no lo medimos: lo
declaró él. Es la frontera de toda la cara pública: lo declarado se enseña como
declarado y lo observado como observado.

Por eso el arreglo no fue borrar el renglón, que era la salida fácil y la que
habría quedado más limpia.

### Las tres familias, que es lo que hay que mirar al agregar un estado

| Familia | Fuente | Cómo la nombra el rótulo |
|---|---|---|
| **Declarado** — arranque, horario, frecuencia, cadencia | el concesionario | «Según el concesionario» |
| **Medido** — `en_vivo` | nuestro instrumento | «En vivo · ±3 min · 20.5 km/h declarados» |
| **No se pudo preguntar** — sin conexión, consultando | nadie | dice qué pasó del lado del teléfono |

**Los cuatro declarados comparten copia a propósito.** La fuente es la misma
persona; darle a cada uno su variante insinuaría que hay tres fuentes distintas,
y es exactamente por donde se había colado la repetición del titular.

**El tercero no se atribuye a nadie, y es deliberado.** Sin conexión no hay
afirmación sobre el servicio: colgarle un «según el concesionario» le atribuiría
a él un silencio que es nuestro.

### `por_horario` — el quinto, resuelto el mismo día

Quedó fuera de la primera pasada porque su fuente parecía mixta: la cadencia la
declaró el concesionario, y que haya servicio lo vimos nosotros —una unidad en
el corredor dentro de la ventana de confianza—.

**Lo destrabó la regla misma.** El rótulo atribuye la afirmación que tiene
**justo encima**, y encima está la cadencia. La otra mitad —que sí hay
servicio— **va en la frase**, que es donde cabe entera. Comprimir las dos en un
renglón de una línea era el problema, no la falta de una respuesta.

Y «Por horario» se iba de todas formas, con atribución o sin ella: **nombra el
modo**, que es vocabulario nuestro y no del pasajero. Era el último rótulo que
lo hacía, y ahora hay prueba de que ninguno lo vuelva a hacer.

| Estado | Titular | Rótulo, antes | Rótulo, ahora |
|---|---|---|---|
| `por_horario` | `Cada 20 min` | «**Por horario**» | «Según el concesionario» |

### ⚠ Lo que este arreglo NO cierra, y hay que decirlo

**Con la frecuencia sin declarar, la atribución dice más de lo que tiene
encima.** En ese caso el titular de `por_horario` es «En servicio» y la frase
«Hay unidades corriendo esta ruta»: las dos salen de lo que vio el GPS, no de
una declaración. «Según el concesionario» le atribuye ahí algo que medimos
nosotros.

**No es una esquina: es el circuito de producción de hoy.** Oasis–Centro tiene
`declared_frequency_minutes` en `NULL` desde la `0031`, justo porque un 20
heredado no era una declaración.

Las dos salidas que se ven, y ninguna se tomó de paso:

1. **Distinguir la rama**: con frecuencia declarada, «Según el concesionario»;
   sin ella, un rótulo de la familia del instrumento — que hay que redactar, y
   sin decir un tiempo.
2. **Dejarlo así** y aceptar que en ese caso el rótulo atribuye de más.

Queda como la decisión abierta de esta ficha.

### La valla

La escalera de siete ternarios anidados salió del JSX a
`lib/rotulo-de-la-tarjeta.ts`. No fue limpieza: **dentro del JSX no se puede
leer si un renglón repite al de arriba**, y ésa es justo la comprobación que
esta pantalla ya falló tres veces.

Y la regla tiene prueba: para los estados declarados, el rótulo **no puede
contener** «horario», «frecuencia» ni «arranque» —los sustantivos que el titular
ya dice— y **sí tiene que contener** «concesionario». Una tercera prueba fija que
**ningún rótulo nombra su modo**. Si alguien deshace cualquiera de las tres, se
cae ahí y no en producción.
