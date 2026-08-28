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
asignadas y ninguna observación reciente cae a `sin_servicio`, **nunca** a
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

## Lo que esta ficha NO afirma

Que los 15 minutos de la ventana de confianza sean el número correcto. Es un
punto de partida declarado; sale de la prueba de campo de los días 11–13.

Y que la escalera se haya visto en los cuatro estados contra producción. Los
que dependen de que un camión esté en el corredor sólo ocurren en las horas de
turno —05:00 a 06:00 y 14:00 a 16:00 en el corredor de laboratorio— y fuera de
esas horas no hay cómo alcanzarlos sin inventar una posición.
