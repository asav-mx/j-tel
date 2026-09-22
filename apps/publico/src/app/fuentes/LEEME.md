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

| Archivo | Familia | Pesos declarados | Papel | sha256 |
|---|---|---|---|---|
| `archivo-variable.woff2` | Archivo | 600–700 (variable) | lo que identifica | `7150c0ec5ad35645` |
| `plex-sans-variable.woff2` | IBM Plex Sans | 400–600 (variable) | lo que se lee de corrido | `056e4e2459f57a00` |
| `plex-mono-400.woff2` | IBM Plex Mono | 400 | toda medición | `c36f509c0a8f9f85` |
| `plex-mono-500.woff2` | IBM Plex Mono | 500 | toda medición | `a76f53ca6612e7b3` |

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

Archivo e IBM Plex se distribuyen bajo **SIL Open Font License 1.1**, que
permite redistribuir los archivos dentro del proyecto.
