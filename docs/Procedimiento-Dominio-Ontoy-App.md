# Procedimiento · Apuntar `ontoy.app` a Vercel, y mudar la app

**23 de septiembre de 2026.** Decisión de ASAV: la app del pasajero se muda de
`juarezbus.digital` a **`ontoy.app`**. Esta hoja es lo que hay que hacer **el día
que Unstoppable Domains termine el registro**, en orden, con lo que se comprueba
en cada paso.

> **Por qué la mudanza.** `juarezbus.digital` es el nombre de **un
> transportista**. La plataforma no se viste de ninguno: el siguiente
> concesionario abriría la app de la ciudad y leería la marca de su competencia
> en la barra de direcciones. Es la misma razón por la que el morado de Juárez
> Bus no entró a la piel y por la que el nombre de la app sale de una variable
> y no del código.

> **El dominio viejo no se apaga: redirige.** Hay letreros impresos, mensajes de
> WhatsApp y teléfonos con la app instalada apuntando ahí. Un dominio que deja
> de contestar se lee como «la app se murió».

---

## 0 · Lo que ya está hecho en el repo

Nada de esto hay que tocarlo el día de la mudanza; se dice para que se sepa qué
está cubierto y qué no:

- **La redirección del dominio viejo** vive en `apps/publico/next.config.ts`,
  conserva la ruta (`/c/zaragoza-centro` llega a `/c/zaragoza-centro`, no a la
  portada) y arranca **temporal (307)**, a propósito — ver el paso 6. La cuida
  `apps/publico/src/lib/mudanza-de-dominio.test.ts`.
- **El dominio canónico** de lo que Next arma en absoluto sale de
  `NEXT_PUBLIC_SITIO`, con `https://ontoy.app` por omisión.
- **El nombre de la app** ya salía de `NEXT_PUBLIC_APP_NOMBRE`: el código no
  conoce nombres propios y sigue sin conocerlos. En producción **ya vale
  `Ontoy`** — comprobado contra el sitio vivo, no leído del código.

**Lo que NO está en el repo, y por eso existe esta hoja:** el DNS, el dominio
dado de alta en el proyecto de Vercel, y la variable del nombre. Eso vive en
paneles, no aparece en ningún PR, y si nadie lo escribe se olvida — la misma
lección del límite del firewall.

### Y qué dirección tiene cada cosa (decidido el 23-sep-2026)

Esta hoja mueve la **casa**; cuál es el cuarto de cada cosa lo decidió ASAV el
mismo día, y vive en **`docs/Ontoy-Direcciones.md`** con su propia valla
(`apps/publico/src/app/direcciones.test.ts`), que entró antes del 28 a propósito.

Lo que hay que saber aquí, porque cambia lo que se comprueba en el paso 4:

- **La app se queda en la raíz.** `ontoy.app/` es Inicio, y el `start_url` del
  manifiesto sigue siendo `/`. La mudanza **no mueve ninguna dirección**: sólo
  cambia el dominio de todas.
- **La landing vive en `ontoy.app/conoce`**, y se escribe después del 29. El día de
  la mudanza esa dirección **todavía no contesta**, y eso es lo esperado: no es un
  defecto de la mudanza.
- Por eso el `curl` del paso 4 prueba la raíz y `/c/‹ruta›`, no una portada.

---

## 1 · Agregar el dominio en Vercel

En el proyecto **`j-tel-publico`** (el de la app del pasajero, no el de la cara
interna):

**Settings → Domains → `ontoy.app` → Add.** Agregar también **`www.ontoy.app`**
y dejar que Vercel lo redirija al dominio sin `www` (lo ofrece al agregarlo).

Vercel muestra los registros exactos que pide. **Usar los que muestre la
pantalla**, que son la fuente buena. Lo que hay que esperar ver:

| Tipo | Nombre | Valor |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns-0.com` |

⚠ **Fíjate en el `-0` del CNAME.** Ese valor cambió; el viejo
`cname.vercel-dns.com` ya no es el documentado, y copiarlo de un tutorial de
hace un año deja el dominio en «Invalid Configuration» sin decir por qué. Es la
misma trampa que se documentó con el dominio anterior.

## 2 · Poner los registros en Unstoppable Domains

`ontoy.app` se registró ahí, así que **sus nameservers son los de ellos y los
registros se editan en su panel, no en Vercel** — igual que `juarezbus.digital`.

En el panel de Unstoppable Domains, en el dominio → **DNS**:

```
A      @      76.76.21.21
CNAME  www    cname.vercel-dns-0.com
```

Mover los nameservers a Vercel también funcionaría, pero es más movimiento del
necesario y deja el dominio administrado en dos lados.

**Comprobar, no suponer:**

```bash
dig +short A ontoy.app          # debe contestar 76.76.21.21
dig +short CNAME www.ontoy.app  # debe contestar cname.vercel-dns-0.com
```

Tarda de minutos a un par de horas. Mientras no conteste eso, Vercel muestra
*Invalid Configuration* y **no es un error de configuración del proyecto**: es
DNS sin propagar.

## 3 · La variable del nombre

```
NEXT_PUBLIC_APP_NOMBRE = Ontoy
```

✎ **Corrección del 23-sep-2026, la misma tarde.** Este párrafo decía «hoy no
está puesta, así que la app se llama Transporte público». **Es falso, y lo
desmiente producción:** la variable existe en el proyecto `j-tel-publico` con
destino *Production*, y `https://www.juarezbus.digital/` contesta hoy con
`<title>Ontoy</title>`. Lo escribí leyendo el código —que trae «Transporte
público» por omisión— en vez de preguntarle al producto. Es la trampa que este
repo ya tiene nombre: dato correcto, afirmación falsa.

**Entonces qué falta aquí:** la variable está en **Production** y **no** en
*Preview* ni en *Development*, así que una copia de prueba **sí** dice
«Transporte público». Si se quiere que las copias de prueba se vean como el
producto, se agrega a esos dos entornos. No es urgente y no bloquea la mudanza.

**Es variable y no código a propósito:** el día que la app sirva a otra ciudad
con otro nombre, eso se cambia sin desplegar.

Si además se quiere mover el dominio canónico sin tocar código (para probar el
traslado en un preview, por ejemplo), es `NEXT_PUBLIC_SITIO`.

**Hay que volver a desplegar** para que una variable `NEXT_PUBLIC_*` surta
efecto: se hornean en la compilación.

## 4 · Comprobar la mudanza, de las dos puntas

```bash
# El dominio nuevo contesta, y sin sesión.
curl -s -o /dev/null -w "%{http_code}\n" https://ontoy.app/

# El viejo redirige y CONSERVA la ruta.
curl -s -o /dev/null -w "%{http_code} → %{redirect_url}\n" https://juarezbus.digital/c/zaragoza-centro
# esperado: 307 → https://ontoy.app/c/zaragoza-centro   (308 después del paso 6)
```

Y a ojo, en un teléfono: abrir `ontoy.app`, ver una ruta con camiones, y
comprobar que la pestaña y el ícono de instalar dicen **Ontoy**.

## 5 · La regla del firewall del dominio nuevo

La regla de límite de tasa es **del proyecto**, no del dominio, así que **sigue
valiendo tal cual** y no hay que volver a ponerla: `j-tel-publico` ya la tiene
para `/api/circuitos/` (y le falta la de `/api/boletos/`, que espera al P3.5).
Ver `Procedimiento-Firewall-Publico.md`.

## 6 · Una semana en temporal, y sólo entonces el permanente

**Decisión de ASAV, 23-sep-2026.** La redirección entra **temporal (307)** y se
queda así **la primera semana**. Recién cuando la mudanza esté probada se sube a
**permanente (308)**, en un PR de una línea: `REDIRECCION_PERMANENTE = true` en
`apps/publico/next.config.ts`.

**Por qué en ese orden, y no al revés.** Los dos códigos mandan al usuario al
mismo lugar; la diferencia es **qué recuerda el teléfono**. El 308 le dice al
navegador *deja de preguntarle al dominio viejo*, y eso es justamente su valor:
el letrero impreso sigue sirviendo sin un salto extra. Pero también es su
riesgo, porque **un 308 equivocado no se revierte**: revertir el despliegue no
despega a nadie —el teléfono ya no vuelve a pedirle a `juarezbus.digital`—, y
el único arreglo es esperar a que caduque su caché o pedirle a cada persona que
la borre. En un producto que se usa parado en la banqueta esperando el camión,
eso no es una opción. El 307 no se guarda: si algo sale mal, se revierte el
despliegue y todo el mundo vuelve al dominio viejo en la siguiente carga.

**Qué hay que ver antes de subirlo a 308** —esto es la prueba, no el
calendario—:

- `ontoy.app` abre en **un teléfono de verdad** (no sólo en `curl`), muestra una
  ruta con camiones y su mapa.
- `juarezbus.digital/c/‹alguna-ruta›` cae en la misma ruta en `ontoy.app`.
- **El lector del camión** (`/validador`) abre en `ontoy.app`, acepta un boleto
  y entrega sus pasos.
- El certificado del dominio nuevo está emitido (Vercel lo muestra en verde) y
  **no hay avisos de dominio inválido**.

Mientras tanto, el 307 cuesta un salto por visita y nada más.

---

## Lo que esta mudanza rompe, dicho antes de que pase

**A quien tenga la app instalada desde `juarezbus.digital` se le va a abrir en
el navegador, no en su app.** Una PWA instalada tiene su origen; cuando la
navegación redirige a otro, el teléfono la trata como un sitio de fuera y sale
de la app instalada. No hay arreglo del lado del servidor: es cómo funcionan
las PWA.

Lo que sí se puede hacer, en este orden:

1. **Nada urgente.** Con señal, la redirección los lleva a `ontoy.app` y la app
   funciona igual, en el navegador.
2. **Reinstalar desde el dominio nuevo**, cuando les convenga. Es «agregar a
   inicio» otra vez, nada más.
3. **Sin señal**, un teléfono con la app vieja instalada sigue abriendo el
   cascarón guardado del dominio viejo. Es lo correcto —abrir y decir «no tengo
   dato» es honesto—, y en cuanto haya red la redirección se cumple: el service
   worker pide a la red primero y sólo cae al caché si no hay.

**Y una pestaña que ya estuviera abierta con el dominio viejo va a fallar al
hablar con el servidor, hasta que se recargue.** Sus peticiones salen al host
viejo, la redirección las manda a `ontoy.app`, y el navegador **no sigue una redirección
a otro origen en una petición del programa** sin permiso explícito de CORS. Se
ve como «la app dejó de responder» y se arregla recargando.

Importa sobre todo para **el lector del camión** (`/validador`), que está abierto
horas seguidas en un teléfono a bordo: el día de la mudanza conviene recargarlo a
mano. Lo que el chofer acepte mientras tanto **no se pierde** —el aparato guarda
sus pasos y los entrega cuando puede—, pero mientras no recargue no entrega
nada.

**Cuántos son:** no se sabe, y no se puede saber. El contador de aperturas
cuenta aperturas y no personas, y no distingue instaladas de navegador (Marco
8.7). Si alguien pregunta cuántos hay que avisar, la respuesta honesta es que no
hay ese dato.

---

## Lo que queda pendiente después de la mudanza

- **La declaración de datos de las tiendas** (`docs/Ontoy-Declaracion-De-Datos.md`)
  dice `https://‹dominio›/privacidad` en dos lugares. Con el dominio vivo, se
  llenan con `https://ontoy.app/privacidad`.
- **`NEXT_PUBLIC_CONTACTO_PRIVACIDAD`**: la página de privacidad dice «el correo
  de contacto todavía no está configurado» mientras no exista. Las dos tiendas
  exigen un contacto, y ahora que hay dominio propio, ese buzón puede ser
  `hola@ontoy.app`.
- **El TWA** (la app de la tienda de Android) apunta a un dominio: el suyo es
  `ontoy.app` desde el principio, no se migra después.
