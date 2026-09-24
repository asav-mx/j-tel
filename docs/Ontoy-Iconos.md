# Ontoy — los íconos: qué archivo va dónde

**El hueco de la identidad se llenó el 23 de septiembre de 2026.** Ontoy (Parte B) dejó los
íconos con **nombre fijo** para que la identidad entrara reemplazando archivos, sin tocar
código. Funcionó: entró sin que `manifest.ts` ni `layout.tsx` cambiaran una sola ruta.

Hoy son **Ontoy «¡Ya viene!»** —ojos arriba, boca abierta, manos flotantes— en naranja
`#F6A15B` sobre Banqueta `#EDE9E1`.

**De dónde salen.** La fuente es `.claude/skills/ontoy-design/export/iconos/`, y de ahí se
copian con el mismo nombre. Dos cosas se les hacen al copiar, y las dos están medidas:

- **A los SVG se les quitan los metadatos C2PA** de la herramienta de diseño: 7 736 bytes de
  procedencia sobre 907 de dibujo. El dibujo queda byte por byte igual.
- **El `apple-touch-icon.png` se aplana sobre Banqueta.** La exportación lo entrega con las
  esquinas transparentes. iOS no maneja alfa aquí —compone lo transparente sobre **negro**— y
  encima le pone su propia máscara redondeada, con una curva distinta a la del archivo. Cuánto
  negro se asoma depende de esa curva: **medido, entre 8 y 296 pixeles** según qué superelipse
  use iOS (con la más citada son 8, ninguno negro puro; con una más suave, 296). No es un
  desastre visible, y tampoco es algo que convenga dejar a la suerte de una curva ajena.
  Aplanado es exactamente el mismo dibujo con su fondo puesto, cuesta 4 KB y quita el riesgo
  completo. Es además lo que esta ficha ya pedía antes de que pasara.

**El azul noche `#1E2B4D` todavía no entra.** Es el color de noche de la identidad y está
aprobado, pero la piel oscura de la app sigue siendo el gris pizarra de `ontoy.css`. Poner la
barra del teléfono en azul marino encima de una app gris se lee como un defecto, no como
identidad. Entra con el PR que cambie la piel por los tokens del skill (decisión de ASAV,
23-sep-2026).

**El ícono viejo** —el camión azul sobre `#0f1418`— quedó archivado en
`docs/archivo/ontoy-icono-provisional/`. No se edita ni se vuelve a usar: se guarda porque fue
lo que estuvo instalado en los teléfonos que probaron la app antes del arranque.

## En la app (`apps/publico/public/`)

| Archivo | Tamaño | Para qué | Lo pide |
|---|---|---|---|
| `icono.svg` | vectorial | Ícono general; el navegador lo escala | `manifest.ts`, `layout.tsx` |
| `icono-mascara.svg` | vectorial | Android recorta el ícono en círculo o gota: el dibujo tiene que caber en el **80 % del centro** | `manifest.ts` |
| `iconos/icono-192.png` | 192 × 192 | Android, pantalla de inicio | `manifest.ts` |
| `iconos/icono-512.png` | 512 × 512 | Android, pantalla de arranque y empaque para Play | `manifest.ts` |
| `iconos/icono-mascara-512.png` | 512 × 512 | Lo mismo, recortable (sin transparencia, zona segura del 80 %) | `manifest.ts` |
| `iconos/apple-touch-icon.png` | 180 × 180 | iPhone, pantalla de inicio (iOS no lee el manifiesto para esto) | `layout.tsx` |

Reglas para el archivo nuevo: PNG sin transparencia en los de máscara; el dibujo
importante dentro del círculo central del 80 %; nada de texto chico (a 48 px no se
lee).

## En las tiendas (no viven en el repo: se suben en la consola de cada tienda)

| Tienda | Archivo | Tamaño |
|---|---|---|
| Google Play | Ícono de la ficha | 512 × 512 PNG, 32 bits, menos de 1 MB |
| Google Play | Imagen destacada | 1024 × 500 PNG o JPG |
| Google Play | Capturas de teléfono | mínimo 2, de 320 a 3840 px por lado |
| App Store | Ícono de la app | 1024 × 1024 PNG, **sin transparencia ni esquinas redondeadas** (Apple las pone) |
| App Store | Capturas | por tamaño de pantalla (6.7″ y 5.5″ como mínimo) |

**El empaque para Android (TWA) no está en esta ficha:** el dominio ya está decidido
—`ontoy.app`, con la app en la raíz— pero el registro no termina todavía. iOS queda dicho, no hecho (ver la memoria de Ontoy: empaquetar la PWA tal
cual no pasa la regla 4.2 de Apple).
