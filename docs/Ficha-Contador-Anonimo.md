# Ficha — El contador anónimo de aperturas

**Fecha: 5 de septiembre de 2026.** App pública del transporte concesionado.
Frente: Tramo JB. Migración: `0033_aperturas_circuito`. Última pieza antes del
arranque del 10.

---

## La pregunta que contesta

**¿Alguien está abriendo esta ruta?**

Una sola, y está construido para no poder contestar ninguna otra. Lo que se
enseña en el expediente del circuito es un número —aparatos distinguibles que
abrieron hoy— y los últimos siete días debajo.

## Las cuatro reglas, con su razón

**1 · La huella la deriva el SERVIDOR, y rota cada día.**

`HMAC(llave; ip + agente + día + circuito)`, truncado. Mismo patrón y mismo
argumento que `idPublicoDelDia`: sin la llave los insumos son adivinables —hay
pocos agentes comunes y los rangos de IP son públicos—, así que un hash a secas
se recalcularía desde fuera y desharía el anonimato.

El día entra al mensaje. **De aquí no sale «cuántos volvieron»**, ni por
accidente ni a propósito.

**2 · Mide aperturas, no regresos, y eso es la decisión — no una limitación
pendiente.**

Medir regresos exige ligar un aparato entre días, que es exactamente lo que la
rotación impide. Si algún día hace falta, **será su propia decisión con su
propio consentimiento**, no una puerta trasera de este contador.

Esto corrige una entrada de `DESPUES.md`: «el pasajero como usuario» decía que
lo desbloqueaba *«gente escaneando QRs y volviendo»*. Los regresos ya no son la
llave, y la entrada se reescribió sobre lo que sí medimos.

**3 · Nada se guarda en el teléfono.**

Ni cookie, ni `localStorage`, ni identificador que viaje de vuelta. El aparato
no recuerda nada, y por eso la deduplicación **tiene que** vivir en la base: es
la única que puede saber que ésta es la segunda apertura del mismo día.

**4 · La apertura es un evento propio y explícito.**

No es preferencia: contar desde el tráfico que ya existe **no funciona**. El
endpoint de la forma se sirve con `s-maxage=300`, así que el CDN contesta casi
siempre sin invocar la función y esas aperturas no llegarían nunca; y el de
unidades se pide cada quince segundos, así que ahí se contarían sondeos, no
gente abriendo la app.

---

## El número está mal por dos lados opuestos, y el rótulo lo dice

Esto es lo que hay que no perder. Las dos advertencias están **medidas y
escritas antes de este trabajo**, en `Procedimiento-Firewall-Publico.md`:

| | Qué pasa | Dónde está dicho |
|---|---|---|
| **El NAT lo hunde** | Detrás de un NAT móvil media colonia sale con la misma IP, y con el mismo modelo de teléfono el mismo agente. Cuentan como un aparato | «un `deny` deja fuera a una colonia entera detrás de un NAT móvil — **que en Juárez es el caso normal, no la excepción**» |
| **El raspado lo infla** | Un guion que abre mil veces desde direcciones distintas entra al conteo | «**No protege contra un raspado lento y distribuido**» |

Por eso el rótulo va **pegado a la cifra y no al pie en chico**:

> Cuenta aparatos que se pueden distinguir, no personas: varios teléfonos detrás
> del mismo NAT cuentan como uno. Y no separa el raspado del uso.

Las dos advertencias van juntas porque son de la misma clase —el número no vale
como personas ni como uso limpio— y dejar una fuera deja a la cifra con la mitad
de su lectura. Hay prueba de que ninguna se caiga, y de que el rótulo **no diga
«pasajeros» ni «visitas»**, que son las dos palabras que saldrían solas si
alguien lo redacta de memoria.

## Se enseña un número y se guardan dos

`open_count` —cuántas veces se abrió desde esa misma huella ese día— **se guarda
y no se enseña**.

No es un dato de reserva: **es el detector.** Contra un raspado lento y
distribuido, que el límite de tasa no cubre, la única señal que queda es la
**distancia entre el crudo y el número de filas**. Un guion que infla las
aperturas sin traer aparatos distintos mueve uno y deja quieto el otro, y eso se
ve desde la base.

Enseñar el crudo como uso sería exactamente el error que este contador vino a
evitar. Guardarlo y callarlo es lo contrario: **la pantalla enseña lo que se
sostiene, y el instrumento conserva con qué dudar de sí mismo.**

## Un cero no es un hueco

Un día sin filas significa dos cosas distintas según cuándo sea. Después de que
el contador empezó a registrar esa ruta, es un cero y es un dato: nadie
distinguible la abrió. **Antes, es que nadie estaba contando**, y dibujar «0»
ahí afirmaría que nadie abrió la app cuando lo cierto es que no había
instrumento — la §D en su forma de alcance, y encima sobre el número con el que
se va a decidir si la app se está usando.

La serie lleva `null` y la pantalla lo dibuja como **«sin registro»**. Y cuando
ningún día de la ventana tiene registro, se dice una vez en lugar de pintar
siete huecos.

Su valla: `serieDeAperturas` pregunta **primero** «¿ya se contaba?» y sólo
después «¿cuántos?». Al revés, un día anterior al contador saldría con cero.

---

## La primera ruta de ESCRITURA de la cara pública

`PLAN.md` define el endpoint público como **«Solo lectura, sin autenticación»**.
Esto lo estrena, y por eso la razón queda escrita ahí mismo y no sólo aquí: para
que la regla vieja no resucite sola ni se lea como si nadie la hubiera pensado.

**Lo que compensa la escritura abierta:**

- **La misma puerta.** Un circuito no publicado contesta lo mismo que un slug
  inventado. Sin eso, ésta sería la puerta más fácil para averiguar qué slugs
  existen — porque una escritura contesta distinto según encuentre o no.
- **El HMAC encarece inflar.** Para sumar N aparatos hay que traer N
  combinaciones distintas de IP y agente; repetir desde la misma sólo mueve el
  crudo, que es el detector.
- **El firewall ya la cubre.** La regla apunta a `/api/circuitos/*` y esta ruta
  cuelga de ahí: hereda el límite sin tocar el panel.
- **No rompe nada si falla.** La app dispara y sigue; no espera la respuesta ni
  la lee. Un contador no rompe una pantalla, y un pasajero parado en la banqueta
  no tiene por qué enterarse de que no pudimos contarlo.

## Lo que NO se tocó

**El camino de ingestión, congelado hasta el 11.** Ni el recolector, ni
`telemetry_points`, ni `live_positions`, ni el archivador. La migración es
puramente aditiva —una tabla nueva— y no escribe en ninguna fila existente.

---

## Verificación

- Pruebas del dominio para la huella: rota por día, no se cruza entre rutas,
  revienta sin llave, y **los separadores impiden que dos insumos distintos
  colisionen** por concatenación.
- Pruebas del endpoint: la puerta cerrada byte por byte, la fecha del circuito y
  no la del servidor, `x-forwarded-for` tomando la primera dirección, `no-store`,
  y que **ni la IP ni el agente crucen hacia la base** — la mitad que ninguna
  prueba de la huella alcanza.
- Integración contra la rama desechable: **el mismo aparato tres veces es una
  fila con el crudo en tres**, dos aparatos son dos filas, y un circuito sin
  aperturas devuelve `null` en vez de una fecha inventada.

---

## Enmienda del 25 de septiembre de 2026 — «abrió una parada»

**Migración: `0057_abrio_una_parada`. Decisión de ASAV.**

### Qué pasó

Hasta el #592, tocar una parada en el mapa **abría la ruta entera**, así que ese
gesto caía en `circuit_opens`. Desde que la hoja de la parada se abre encima del
mapa —que es lo que el pasajero hace todo el tiempo— la ruta ya no se abre.

Eso dejó al contador viejo **sin ver el gesto más común de la app**, y sin que
nada fallara: la cifra habría seguido saliendo, más chica, y nadie habría podido
decir si la app se usaba menos o si sólo habíamos dejado de contar. Es la §D en
su forma de alcance, sobre el único número con el que se decide eso.

### La decisión: que cuente, pero como lo que es

Un contador **aparte**. «Abrió una parada» en `stop_opens`, y «abrió una ruta»
en `circuit_opens`, intacto. **Las dos cifras no se suman**, y el instrumento
está construido para que no se puedan sumar por descuido:

- **Dos tablas y no una columna `stop_id`.** Con una columna nullable, toda
  consulta que hoy cuenta filas —las que existen y las que alguien escriba
  mañana— empezaría a sumar aperturas de parada dentro de «abrió una ruta» salvo
  que se acuerde de filtrar. Dos poblaciones que miden cosas distintas no se
  separan con la disciplina de quien consulta.
- **La palabra `parada` va DENTRO del mensaje del HMAC.** Así una huella de
  parada no puede coincidir con una de circuito ni aunque los identificadores
  fueran iguales. Hay prueba de eso, y se cae si alguien quita la palabra.

### Qué NO cambia

Las cuatro reglas de arriba valen igual: la huella la deriva el servidor y rota
cada día, mide aperturas y no regresos, nada se guarda en el teléfono, y es un
evento propio y explícito. **Las dos advertencias del rótulo también:** el NAT la
hunde y el raspado la infla, con las mismas palabras y por las mismas razones.

### Dónde vive, y por qué ahí

`POST /api/circuitos/‹ruta›/paradas/‹parada›/apertura`, colgada del circuito.

**No es jerarquía: es el firewall.** Esta ficha apoya la escritura pública
abierta en que «el firewall ya la cubre… hereda el límite sin tocar el panel», y
esa regla apunta a `/api/circuitos/*`. Una ruta en `/api/paradas/*` **no
heredaría nada**, y habríamos estrenado una segunda escritura pública sin el
límite que justifica a la primera, sin que nada fallara ni nadie se enterara.

De paso, tener el circuito en la dirección permite comprobar que la parada es
suya: sin eso, cualquiera podría sumarle aperturas a la parada de otra ruta
mandando el slug que quisiera.

### RESTRICT en las dos, y por qué se corrigió

La primera versión de la 0057 puso **CASCADE** en `stop_opens.stop_id`, copiando
el patrón de `circuit_opens` y de `circuit_stop_versions`. ASAV lo cazó en la
revisión y tenía razón: **fue un patrón copiado, no una decisión pesada.**

El argumento que sí aplica aquí: **una apertura no se puede recalcular.** Es un
evento observado, no un derivado. Si se borra no hay de dónde volver a sacarlo, y
el hueco que deja se lee como «nadie abrió» — la §D en su forma de alcance,
encima del único número con el que se decide si la app se usa. CASCADE convierte
un borrado, que ya es una anomalía, en la destrucción silenciosa de esa medición.

Y **borrar ya no es la forma de quitar una parada**: `circuit_stops` tiene
`retired_at` desde su primer día, y hoy no existe ningún camino que borre una —
ni un método del repositorio, ni una pantalla de J-Staff; sólo los guiones de
escenario. RESTRICT no le quita a nadie una operación legítima: cierra la
ilegítima, igual que la 0055 con el circuito.

`circuit_opens` se enderezó en la misma migración. Dejar una CASCADE y la otra
RESTRICT habría sido peor que las dos iguales, porque nadie podría decir cuál es
la regla.

**Lo que costó, que es el mismo costo de la 0055:** las limpiezas que borran
cuentas o circuitos con aperturas tienen que borrar las aperturas primero — y
`stop_opens` antes que la parada. Son guiones de escenario y `afterAll` de
pruebas; ninguna pantalla borra cuentas ni circuitos.

### Un cero sigue sin ser un hueco, y aquí importa más

Este contador **nace el 25-sep-2026**. Todos los días anteriores de todas las
paradas son hueco, no cero. `primerDiaConAperturasDeParada` existe para eso, y
es lo que cualquier pantalla tendrá que preguntar **antes** de dibujar un cero.

### Lo que todavía no existe

**Ninguna pantalla lo enseña.** El expediente del circuito enseña las aperturas
de la ruta; el de una parada no existe todavía. Se construye el contador ahora
—y no cuando haya pantalla— porque **las aperturas no se pueden rellenar hacia
atrás**: cada día que pase sin registrar es un hueco permanente en la serie.

---

## Lo que esta ficha NO afirma

Que el número vaya a parecerse al de personas que usan la app. No va a
parecerse, y por eso el rótulo lo dice. **Lo que este contador puede sostener es
un piso** —hubo al menos tantos aparatos distinguibles— y una tendencia entre
días comparables.

Y que el raspado se pueda separar. Hoy no se puede: lo único que hay es la
distancia entre las dos cifras, que sugiere pero no prueba. El día que el
`Procedimiento-Firewall-Publico` se reabra «con datos», éstos son los datos.
