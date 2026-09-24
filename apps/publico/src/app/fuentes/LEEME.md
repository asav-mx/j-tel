# La letra de Ontoy vive en el repo

Estos `.woff2` están commiteados a propósito. **No son un caché: son lo que
impide que una llamada a internet tumbe la compilación.**

## Por qué

`next/font/google` no empaqueta las fuentes: **las descarga durante
`next build`**. Si Google no contesta, no falla la tipografía — **falla el
build**:

```
An error occurred in `next/font`.
TypeError: Cannot read properties of null (reading '1')
```

Pasó en CI el **22 de septiembre de 2026** en #493 y #498 —PRs que no tocaban
esta app— y se arreglaba re-corriendo. Intermitente, que es la peor forma: **no
se distingue de un defecto propio hasta leer el log**. La web ya había pagado la
misma lección el 12 de agosto (#294, ver `apps/web/src/app/fuentes/LEEME.md`).

La valla `scripts/verificar-fuentes-locales.mjs` (raíz del repo) corre en CI
antes de compilar y **se cae si cualquier app vuelve a importar
`next/font/google`**.

## Qué hay aquí

**La app y la landing usan la misma letra, y es un archivo por familia.** Antes
no: la app iba con Archivo + IBM Plex (prototipo del 21-sep) y la landing nació
con las de los tokens. Desde el PR de los tokens la app también, así que las
tres del prototipo salieron del repo — un `.woff2` que nadie declara no se
sirve, pero sí se clona, se revisa y se cree vigente.

| Archivo | Familia | Pesos declarados | Papel | Bytes | sha256 |
|---|---|---|---|---|---|
| `bricolage-variable.woff2` | Bricolage Grotesque | 600–800 (variable) | títulos, placas y cifras | 76 868 | `85f55a58a31e61a2` |
| `instrument-sans-variable.woff2` | Instrument Sans | 400–700 (variable) | el texto | 29 904 | `6219bc4bfdfc5d9b` |

**Lo que el pasajero baja bajó.** Antes, quien abría la app pedía cuatro
archivos —95 292 bytes entre Archivo, Plex Sans y las dos Plex Mono—. Ahora pide
dos: **106 772**. Son **11 480 bytes más**, y de dónde salen está abajo.

**Y ya no se baja dos veces.** Quien entra por la portada y toca «Ver las rutas»
traía seis archivos entre las dos páginas; ahora son los mismos dos, servidos de
la misma URL: la segunda página no pide nada.

### Los 36 KB de Bricolage, que ahora los paga la app

Bricolage tiene **dos ejes**: el peso y `opsz` —el tamaño óptico, que reajusta
el dibujo según de qué tamaño se vaya a ver—. Pidiéndolo con `opsz` **fijo**,
Google sirve **41 236 bytes**: 36 KB menos. No se fija, y el navegador lo mueve
solo con `font-optical-sizing: auto`.

**Cuando esto era sólo de la landing, el argumento era fácil:** es la portada,
se paga una vez, y los titulares de 76 px viven de ese eje. **Ahora lo paga
también la app que alguien abre en la parada todos los días**, y ahí el rango es
más angosto —de la placa de 14 px al número de 40—, así que el eje rinde menos.

Se queda sin fijar, por dos razones y conviene tenerlas escritas:

1. **Fijarlo pediría un segundo archivo.** Los bytes de `opsz` fijo son otros,
   así que la app y la landing dejarían de compartir descarga: 41 KB para la app
   **más** 77 KB para la portada, y quien pase por las dos baja los dos. Sale
   peor que los 36 KB.
2. **La placa es lo que más se lee y lo más chico que hay.** Es donde el tamaño
   óptico se nota, y es el elemento que el pasajero mira de pie, a un metro.

Si algún día pesan más de lo que valen, el cambio es un renglón en `FAMILIAS`
dentro del guion — y entonces hay que medir de nuevo las dos cuentas de arriba.

### La monoespaciada se fue y no tiene reemplazo

El sistema de Ontoy no tiene mono. Lo que IBM Plex Mono de verdad daba en esta
app no era la familia sino **`tabular-nums`** —que las cifras midan lo mismo y
no bailen al cambiar—, y eso Instrument Sans lo da igual. Vive en la clase
`.cifra` de `ontoy.css`, que hasta este PR se llamaba `.mono`.

**Son byte por byte los que `next/font/google` servía** antes del cambio: el
pasajero no descarga ni un byte más.

**Subset `latin`**, el mismo que se precargaba. Cubre el español completo:
acentos, `ñ`, `¿`, `¡`. Los otros subconjuntos que Google declaraba (latin-ext,
cirílico, vietnamita) no se traen: ningún texto de Ontoy los usa. Las flechas y
los símbolos que sí aparecen (`←`, `→`, `⚠`, `☀`…) **no venían en ningún
archivo de Google** y siguen dibujándose con la letra del sistema, igual que
antes.

## Por qué no son los mismos archivos que `apps/web`

Mismas familias, mismos caracteres, mismo rango de peso — pero el guion de la
web pide a Google con un navegador de Windows, y a Windows Google le sirve los
archivos **con hinting**: ~15 KB más entre los cuatro. El de Ontoy pide como
pedía `next/font/google` (Chrome de Mac) y baja los archivos sin hinting. Para
una app que se usa en la calle con datos contados, esos 15 KB cuentan.

## Cómo se actualizan

```
pnpm --filter @jtel/publico fuentes:traer
```

El guion (`apps/publico/scripts/traer-fuentes.mjs`) imprime tamaño y hash de
cada archivo. **No corre en la compilación ni en CI** — si corriera, volveríamos
a depender de la red.

Si algún hash cambia contra la tabla de arriba, la fuente se actualizó aguas
arriba: **se ve en el navegador en las dos pieles y en celular antes de
commitear**, y se actualiza la tabla.

## Licencias

Las cuatro familias —Archivo, IBM Plex, Bricolage Grotesque e Instrument Sans—
se distribuyen bajo **SIL Open Font License 1.1**, que permite redistribuir los
archivos dentro del proyecto.
