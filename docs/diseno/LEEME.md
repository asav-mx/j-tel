# El diseño de Ontoy, desempacado

Aquí vive el **dibujo aprobado** de Ontoy, sin comprimir y en el repo. Decisión
de ASAV del 24 de septiembre de 2026: *el diseño vive en el repo, desempacado y
mergeado*.

## Por qué desempacado y no en un `.zip`

Porque un zip en el repo es un archivo que nadie abre. No se puede buscar dentro,
no sale en un `grep`, no se puede enlazar a un renglón, y un cambio en él aparece
en el diff como «binario cambió». El motivo de tener el diseño aquí es poder
**abrirlo mientras se construye** y poder **comprobar contra él** lo que se
construyó; las dos cosas se pierden con el zip cerrado.

De paso, así el diseño sobrevive al PR que lo trajo. Los dos paquetes llegaron
como zips en PRs que se cerraron sin mergear (#552 y #567): si no se desempacan,
el dibujo aprobado vive sólo en la rama de un PR cerrado.

## Qué hay

| Carpeta | Qué | De dónde vino |
|---|---|---|
| `app-v1/` | El paquete **«Lanzamiento»**: las pantallas de la app v1, el lote 6, la piel de noche, las **láminas** de parada, los posts y las historias | #567 |
| `landing/` | El dibujo de la **landing** de `ontoy.app` | #552 |

Los dos son **byte por byte** lo que Asav entregó. No se corrigen aquí: lo que
cambió después se anota donde vive la regla —`ENMIENDAS.md` del skill
`ontoy-design`— y en el código, no encima del dibujo. Un dibujo corregido a mano
deja de servir para comprobar contra él.

## Cómo se abren

Son archivos de la herramienta de diseño: HTML con `<x-dc>`, plantillas
`{{ }}` y un `support.js` que los hace andar. **Se abren en un navegador**, no se
sirven como parte de ninguna app. No los compila nadie y no entran en ningún
paquete: son documentación.

## Lo que NO son

**No son la fuente de la verdad de lo construido.** Donde el código y el dibujo
digan cosas distintas, manda lo que esté escrito en el Marco y en las enmiendas —
y hay varios sitios donde eso pasa a propósito, porque el dibujo prometía cosas
que la versión 1 no hace (el planeador, las notificaciones, los minutos). Cada
uno está anotado en el código que lo cambió.
