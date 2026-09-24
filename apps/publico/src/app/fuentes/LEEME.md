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

**La app y la landing no usan la misma letra**, y es a propósito. La app va con
Archivo + IBM Plex (decisión de ASAV, 21-sep). La landing va con Bricolage
Grotesque + Instrument Sans, que es lo que declaran los tokens del sistema de
diseño (`.claude/skills/ontoy-design/tokens/typography.css`) y con lo que está
dibujada la landing aprobada. Es temporal: la app cambia a los tokens en su
propio PR.

**Nadie baja las seis.** El navegador sólo pide los archivos que la página que
abrió declara, y son dos páginas distintas: quien entra a la landing baja dos
archivos, quien abre la app baja los otros cuatro.

### De la app

| Archivo | Familia | Pesos declarados | Papel | sha256 |
|---|---|---|---|---|
| `archivo-variable.woff2` | Archivo | 600–700 (variable) | lo que identifica | `7150c0ec5ad35645` |
| `plex-sans-variable.woff2` | IBM Plex Sans | 400–600 (variable) | lo que se lee de corrido | `056e4e2459f57a00` |
| `plex-mono-400.woff2` | IBM Plex Mono | 400 | toda medición | `c36f509c0a8f9f85` |
| `plex-mono-500.woff2` | IBM Plex Mono | 500 | toda medición | `a76f53ca6612e7b3` |

### De la landing

| Archivo | Familia | Pesos declarados | Papel | Bytes | sha256 |
|---|---|---|---|---|---|
| `bricolage-variable.woff2` | Bricolage Grotesque | 600–800 (variable) | títulos, placas y números | 76 868 | `85f55a58a31e61a2` |
| `instrument-sans-variable.woff2` | Instrument Sans | 400–700 (variable) | el texto | 29 904 | `6219bc4bfdfc5d9b` |

**Por qué Bricolage pesa 77 KB y no 41.** Tiene **dos ejes**: el peso y `opsz`
—el tamaño óptico, que reajusta el dibujo de la letra según de qué tamaño se
vaya a ver—. Pidiéndolo con `opsz` fijo, Google sirve **41 236 bytes**: 36 KB
menos. Pero la landing aprobada no declara `opsz` en ningún lado, así que el
navegador usa `font-optical-sizing: auto` y lo mueve solo — y eso es lo que
hace que el título de 76 px y la placa de 14 px estén dibujados cada uno para
su tamaño. Fijarlo dibujaría los titulares del hero con el trazo pensado para
texto chico.

Los 36 KB son el precio de los titulares, y se paga **una vez**: es la portada,
no la app que se abre en la parada todos los días. Si algún día pesan más de lo
que valen, el cambio es un renglón en `FAMILIAS` dentro del guion.

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
