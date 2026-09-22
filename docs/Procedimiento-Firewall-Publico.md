# El límite de tasa del endpoint público

**Escrito el 27 de agosto de 2026, al construir el endpoint del Tramo JB.
Rehecho el 21 de septiembre de 2026:** la regla que aquí se describía **nunca se
puso** — el proyecto `j-tel-publico` no tenía configuración de firewall — y la
acción que pedía (*Challenge*) le habría roto la pantalla al pasajero. Ver
«Lo que cambió el 21-sep» abajo.

> **Este límite NO vive en el repo.** Es una regla del firewall de Vercel, y esa
> es exactamente la razón por la que este archivo existe: lo que no está en el
> código no aparece en un PR, no se prueba en local y no se le cae encima a
> nadie cuando falta. **Se comprobó el 21-sep: durante casi cuatro semanas el
> código decía «el límite lo pone el firewall» y el firewall no tenía nada.**
> Si borras este archivo, en tres semanas nadie sabe que el endpoint depende de
> una regla puesta a mano.

> **El proyecto de Vercel que hospeda ese endpoint se crea con
> [`Procedimiento-Proyecto-Publico.md`](Procedimiento-Proyecto-Publico.md).**
> Esta regla se pone ahí (`j-tel-publico`), no en el proyecto de la cara interna.

---

## La decisión, y lo que costó

El `PLAN.md` §Tramo JB dice que el endpoint público lleva **caché y límite de
tasa, obligatorios**. Había tres caminos y se escogió el primero, el 26 de
agosto de 2026; el 21 de septiembre se confirmó por una razón nueva:

| Camino | Por qué sí o por qué no |
|---|---|
| **Firewall de Vercel** | **Escogido.** Cero código, cero dependencias, cero secretos, frena el abuso antes de tocar una función — y **cuenta antes del CDN**, así que ve todas las peticiones, y el contador ya es global entre instancias. |
| Upstash Redis por Marketplace | Un contador dentro de la función **sólo vería las respuestas que el caché no sirvió**: con 15 s de TTL, casi nada. Contaría mal justo lo que se quiere contar. Además, costo y una dependencia más. |
| Solo caché | Contradice el PLAN. |

**El costo aceptado:** el límite no se revisa en un PR ni se ejercita en local.
Se compensa con este procedimiento y con la comprobación de abajo.

---

## Qué frena el límite, y qué NO

**Aceptado por ASAV el 21 de septiembre de 2026, y escrito para que nadie le
atribuya al límite lo que no hace.**

El número económico sale en `/api/circuitos/[slug]/unidades` desde el 21-sep
(Pieza 8.5), en lugar del identificador opaco que rotaba cada día. La
protección contra el raspado cambió de lugar: **sólo posición actual, nunca
historia** (el endpoint), y **este límite**.

- **Frena el barrido masivo:** alguien recorriendo slugs, pidiendo muchas rutas
  desde una IP, o pidiendo el mismo circuito cientos de veces por minuto con el
  encabezado que sea para saltarse el caché.
- **Las favoritas no suben la cuenta (PR 3b, 22-sep).** Inicio y el Mapa de la
  ciudad piden los camiones de TODAS las rutas guardadas en **una** consulta
  cada 15 s (`/api/circuitos/en-vivo?rutas=…`, como mucho 8 rutas): siguen
  siendo **4 peticiones por minuto por pasajero**, tenga una favorita o cinco.
  Antes, cada tarjeta de Inicio sondeaba la suya. La lista va ordenada, así que
  dos teléfonos con las mismas favoritas comparten la respuesta del CDN.
- **NO frena a quien sigue UNA ruta.** La app pide las unidades cada 15 s y el
  CDN guarda cada respuesta 15 s. Un guion que quiera el recorrido de los
  camiones de una ruta necesita exactamente eso: 4 peticiones por minuto, igual
  que un pasajero. Ningún límite por IP los distingue.
- **Y eso es aceptable, porque lo que obtiene es público** (Pieza 9.14): que un
  camión de servicio público pasó por un punto a cierta hora, con el económico
  que trae pintado en el costado. Cualquiera lo observa desde la calle.

**No hay cuentas en la app**, así que «límite por teléfono» es, en la práctica,
**límite por IP**.

---

## La regla

En el proyecto de Vercel **`j-tel-publico`** → **Firewall** → **Rate Limiting**:

| Campo | Valor | Por qué |
|---|---|---|
| Ruta | `/api/circuitos/*` (prefijo `/api/circuitos/`) | Todo el endpoint, cualquier circuito: forma, unidades y aperturas; y desde el 22-sep también `/api/circuitos/en-vivo` (las favoritas, en una consulta) y `/api/circuitos/paradas-de-la-ciudad` (que vivía en `/api/paradas`, **fuera** de la regla). **Todo lo que la app pide vive bajo este prefijo**, y una prueba (`apps/publico/src/lib/rutas-pedidas.test.ts`) se cae si alguien agrega una consulta fuera de él. |
| Llave | **IP** | No hay otra: la app no tiene cuentas. |
| Ventana | **60 s**, ventana fija | Larga para que un pico normal no la toque. |
| Límite | **120 peticiones por IP** | ASAV, 21-sep: las compañías de celular meten muchos teléfonos detrás de una misma IP, y en Juárez es el caso normal. Un pasajero hace 4 por minuto; 120 son treinta pasajeros con la app abierta detrás de una IP, y sigue siendo muy poco para un barrido. |
| Acción | **429** («Too Many Requests»), **no** *Challenge* ni *Deny* | Ver abajo. |

**Por qué 429 y no *Challenge*.** El desafío es una página para un humano en un
navegador. La app no navega a este endpoint: lo pide con `fetch` cada 15 s, y
un desafío ahí es una respuesta que no es JSON — la pantalla se rompe en lugar
de frenar al guion. El 429 es la respuesta que un programa entiende, y **la app
sabe qué hacer con él** (`apps/publico/src/lib/ontoy/ritmo-del-sondeo.ts`):

- conserva en pantalla lo último que se supo, con su edad, y dice que no pudo
  preguntar (el estado `error` que ya existía);
- **se aparta:** espera lo que diga `Retry-After`, o dobla la espera, hasta un
  tope de 2 min; al primer éxito vuelve a los 15 s. Insistir contra un 429 sigue
  contando contra el mismo límite que comparten los teléfonos de esa IP.

**Por qué no *Deny*.** Un bloqueo con duración deja fuera a una colonia entera
detrás de un NAT móvil. El 429 sólo corta el exceso de esa ventana.

**Las aperturas:** un 429 al `POST /apertura` se pierde en silencio (el contador
no rompe pantallas) y esa apertura no se cuenta. La demanda por parada ya se
declara como indicio, no como conteo (Pieza 9.4); esto es una razón más.

**Encender también «Attack Challenge Mode» no.** Ese es para cuando ya estás bajo
ataque; encendido de base le pone un obstáculo a cada pasajero.

---

## Cómo se pone: primero registrar, después bloquear

**El orden importa:** la regla se crea **después** de que la app que maneja el
429 esté desplegada. Una regla que corta antes de que la app sepa apartarse
convierte cada disparo en una pantalla que insiste cada 15 s.

1. **Fase 1 — sólo registrar, unos días.** La misma regla con la acción
   **Log** en lugar de 429. No bloquea a nadie; deja ver en **Firewall → Logs**
   cuántas veces habría mordido y contra quién.
2. **Revisar el registro con ASAV.** Si mordió con uso normal (una IP con varios
   pasajeros, sin nada raro), el límite está muy abajo: se sube antes de
   bloquear.
3. **Fase 2 — cambiar la acción a 429.** Sólo con el sí de ASAV.

Quién la pone: Claude, desde la sesión, con el sí explícito de ASAV — es
producción.

---

## Cómo se comprueba que está mordiendo

Una valla que nadie vio fallar es una suposición con nombre de garantía. Después
de ponerla (en cada fase):

1. En **Firewall → Logs** del proyecto público, filtrar por la regla. Con tráfico
   normal debe salir **cero**: si dispara sin ataque, el límite está muy abajo y
   está estorbando a pasajeros reales.
2. Provocarla a propósito desde una IP propia —ciento veintitantas peticiones
   seguidas al mismo circuito dentro del minuto— y **verla en el log** (fase 1)
   o **recibir el 429** (fase 2). Si no aparece, la regla está mal apuntada:
   casi siempre es la ruta, que en este proyecto **no** lleva el prefijo del
   dominio.
3. Comprobar que el caché sigue haciendo su parte: dos peticiones seguidas al
   mismo circuito deben traer `age:` creciente y el mismo `generado_en`. Si
   `generado_en` cambia en cada llamada, el CDN no está guardando nada y el
   límite se va a disparar con uso normal.

La respuesta de unidades se sirve con
`cache-control: public, max-age=0, s-maxage=15` — **sin**
`stale-while-revalidate` (el endpoint explica por qué; la versión de agosto de
este archivo todavía lo citaba).

---

## Qué NO resuelve esto

- **No sustituye al filtro del servidor.** Publicación, horario y asignación se
  resuelven en el endpoint. El firewall limita cuántas veces preguntas, no qué
  te contestan.
- **No frena el seguimiento de una ruta** — ver «Qué frena el límite, y qué NO».
- **No protege contra un raspado lento y distribuido** entre muchas IPs. Si eso
  llega a pasar, se reabre con datos del registro.

---

## Lo que cambió el 21-sep

| Agosto | Septiembre | Por qué |
|---|---|---|
| La regla «estaba puesta» | No existía | La API de Vercel contestó que `j-tel-publico` no tenía configuración de firewall. |
| 60 por minuto | 120 por minuto | ASAV: muchos teléfonos detrás de una IP celular. |
| *Challenge* | **429**, con fase previa de sólo registrar | Un desafío a un `fetch` rompe la pantalla; la app ahora sabe apartarse ante un 429. |
| Protegía un id opaco | Protege contra el barrido, con el económico ya público | El id opaco se retiró (Pieza 8.5). |

---

## Cuándo se reabre

Cuando exista tráfico real medido, o cuando el registro muestre disparos contra
pasajeros en vez de contra guiones. Lo que ahí se compara ya no es «qué es más
barato» sino «qué está pasando», que es la única forma honesta de elegir.
