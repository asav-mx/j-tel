# Ficha de Handoff — KML vacío no debe condenar al carrier

**Repo:** `j-tel` — guardar en `docs/Ficha-Handoff-KML-Vacio.md`. Entra por PR.
**Fecha:** 15 de julio de 2026
**Autoridad:** el Marco Maestro es la única fuente de verdad. Donde esta ficha y el Marco choquen, gana el Marco.

---

## De dónde salió esto

Depurando por qué la planta 47 (seed) daba **todos los servicios `no_cumplido`**, se encontró que su KML de seed es una cáscara sin coordenadas:

```
kmlContent: "<kml><Document><name>Ruta Norte</name></Document></kml>"
```

El motor recibe una ruta sin línea que medir → match 0% → cae bajo el umbral → `no_cumplido` para todos.

**Esto NO es un bug de producción** (era solo el seed). Pero destapó un hueco real del motor que sí hay que cerrar: un KML vacío o inválido está produciendo un veredicto de incumplimiento contra el carrier.

---

## Tarea A (trivial, sin riesgo) — Arreglar el seed de la 47

**Rama:** `chore/seed-47-kml-real`

Reemplazar el `kmlContent` vacío de la Ruta Norte (planta 47) por un KML con coordenadas reales del corredor de esa ruta, coherente con la geocerca destino `Tecma 47 Destino` y con los puntos de telemetría de prueba, para que el seed de la 47 verifique como Santos Dumont y sirva de dato de desarrollo útil.

Es solo datos de desarrollo. Cero riesgo. PR normal.

---

## Tarea B (motor — 🛑 PUNTO DE PARADA OBLIGATORIO)

**No escribir código sin visto bueno de Asav.** Toca el árbitro.

**El problema de fondo:** una regla ausente no es lo mismo que una regla incumplida. Si el KML de un perfil no tiene coordenadas usables, el motor **no tiene contra qué medir** — eso es *falta de evidencia de la regla*, no *incumplimiento del carrier*. Condenar al carrier por un archivo que el cliente subió mal viola la ley del Marco: **"sin evidencia ≠ incumplimiento"**, y agrieta la confianza en el veredicto (el activo defendible del producto).

**Antes de tocar el motor, presentar a Asav en español simple:**

1. **Punto de decisión — ¿dónde se ataja el KML vacío?** Hay dos capas posibles y hay que elegir (o ambas):
   - **En la carga (preferible):** validar el KML al subirlo. Si no tiene coordenadas parseables, rechazar la carga con mensaje claro al cliente ("este archivo no contiene una ruta; súbelo de nuevo"). El perfil nunca queda con una ruta fantasma. Es la muralla más limpia: el dato malo no entra.
   - **En la verificación (red de seguridad):** si por lo que sea una ocurrencia llega a verificarse contra un KML sin coordenadas, el veredicto debe ser `pendiente_evidencia` con motivo "ruta no disponible / inválida", **nunca** `no_cumplido`. El carrier no carga con el error del cliente.

2. **Recomendación a discutir:** ambas. Validar en la carga para que no entre basura, y la red de seguridad en verificación para que ninguna ocurrencia histórica o mal migrada condene a nadie. Cinturón y tirantes.

3. **Qué NO cambia:** los tres estados de cara al cliente siguen siendo los mismos. No se inventa un estado nuevo. `pendiente_evidencia` ya existe y es exactamente el correcto para "no tengo con qué juzgar".

4. **Mostrar 2 ejemplos** de cómo cambiaría el veredicto de la 47 (seed) con la red de seguridad puesta: de `no_cumplido` → `pendiente_evidencia`.

Solo después del OK de Asav, y en rama propia (`fix/kml-vacio-no-condena`), implementar lo aprobado. Exigir que la suite de tests del motor (`@jtel/verification`) siga verde, y **agregar un test nuevo** que fije la regla: KML sin coordenadas → `pendiente_evidencia`, jamás `no_cumplido`.

---

## Reglas de trabajo

- Una rama por tarea; todo por PR; nunca directo a `main`.
- Checks en verde o no hay merge.
- La Tarea A puede correr ya. La Tarea B **se detiene** en el punto de decisión hasta que Asav apruebe el enfoque.
- Modo "avanza y detente".

## Prohibido

- Que un KML vacío/ inválido produzca `no_cumplido`.
- Inventar un estado nuevo de cara al cliente.
- Tocar el motor (Tarea B) antes del OK de Asav.
- Cambiar veredictos históricos como efecto colateral: si la red de seguridad cambia el criterio, aplica hacia adelante; los hechos ya congelados no se reescriben salvo orden explícita de Asav vía J-Staff.
