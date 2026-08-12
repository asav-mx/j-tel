# Las fuentes viven en el repo

Estos `.woff2` están commiteados a propósito. **No son un caché ni una
optimización: son lo que impide que una llamada a internet pueda tumbar la
compilación.**

## Por qué

`next/font/google` no empaqueta las fuentes: **las descarga durante
`next build`**. Cada compilación sin caché sale a `fonts.gstatic.com`, y si esa
llamada falla, no falla la tipografía — **falla el build**:

```
Failed to fetch font file from https://fonts.gstatic.com/s/archivo/...
next/font error: Failed to fetch `Archivo` from Google Fonts.
> Build failed because of webpack errors
```

Pasó el **12 de agosto de 2026** en el PR #294: tres reintentos automáticos
fallaron y el job quedó en rojo por un cambio que solo tocaba documentos. Las 14
corridas anteriores del día habían pasado, así que era intermitente — y ésa es
justo la peor forma: **no se distingue de un defecto propio hasta leer el log**.

Un reintento cuesta minutos. El mismo fallo durante un despliegue urgente cuesta
más.

## Qué hay aquí

| Archivo | Familia | Pesos | Tipo |
|---|---|---|---|
| `archivo-variable.woff2` | Archivo | 600–800 | variable |
| `plex-sans-variable.woff2` | IBM Plex Sans | 400–500 | variable |
| `plex-mono-400.woff2` | IBM Plex Mono | 400 | estático |
| `plex-mono-500.woff2` | IBM Plex Mono | 500 | estático |

**Subset `latin`** — el mismo que pedía `subsets: ["latin"]`. Cubre el español
completo: acentos, `ñ`, `¿`, `¡`. **Ningún glifo cambió** respecto de lo que se
servía antes.

⚠ **Dos son VARIABLES, y eso no es un detalle de empaquetado.** Google sirve un
solo archivo para todos los pesos de Archivo e IBM Plex Sans — los descargados
para 600 y 700 salieron **byte por byte idénticos**, y el de 600–800 también.
Declararlos como dos pesos estáticos habría hecho que el navegador **sintetizara
el 700 engrosando el 600**: un titular que se ve casi bien y no es el tipo. Por
eso el layout declara **rangos** (`weight: "600 700"`), no pesos sueltos.

Y por eso el landing puede compartir el archivo sin compartir el peso: **la
separación vive en el rango declarado, no en el archivo**.

## Cómo se actualizan

```
pnpm --filter @jtel/web fuentes:traer
```

El guion (`scripts/traer-fuentes.mjs`) imprime tamaño y hash de cada archivo.
**No corre en la compilación ni en CI** — si corriera, volveríamos a depender de
la red, que es el defecto que esto vino a quitar.

Si algún hash cambia, la fuente se actualizó aguas arriba: **se ve en el
navegador en los dos temas antes de commitear.**

## Licencias

Archivo y IBM Plex se distribuyen bajo **SIL Open Font License 1.1**, que
permite redistribuir los archivos dentro del proyecto.
