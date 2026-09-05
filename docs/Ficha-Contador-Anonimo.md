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

## Lo que esta ficha NO afirma

Que el número vaya a parecerse al de personas que usan la app. No va a
parecerse, y por eso el rótulo lo dice. **Lo que este contador puede sostener es
un piso** —hubo al menos tantos aparatos distinguibles— y una tendencia entre
días comparables.

Y que el raspado se pueda separar. Hoy no se puede: lo único que hay es la
distancia entre las dos cifras, que sugiere pero no prueba. El día que el
`Procedimiento-Firewall-Publico` se reabra «con datos», éstos son los datos.
