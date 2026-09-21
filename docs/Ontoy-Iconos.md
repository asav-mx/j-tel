# Ontoy — los íconos: qué archivo va dónde

**El hueco de la identidad.** Ontoy (Parte B) deja los íconos con **nombre fijo**. La
identidad de Ontoy la define Asav; cuando exista, se reemplazan estos archivos
**con el mismo nombre y el mismo tamaño**, y no se toca código.

Hoy todos son **provisionales**: el camión azul sobre fondo oscuro, dibujado desde
`icono.svg`.

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

**El empaque para Android (TWA) no está en esta ficha:** espera a que Asav decida el
dominio. iOS queda dicho, no hecho (ver la memoria de Ontoy: empaquetar la PWA tal
cual no pasa la regla 4.2 de Apple).
