# Ficha — La escalera de cuatro estados de la app pública

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
