/**
 * **La raíz de `ontoy.app`, que va a ser de la landing.**
 *
 * Decisión de ASAV del 25-sep-2026: la gente escribe «ontoy.app» y nada más, así
 * que la raíz es de la landing y **la app vive en `/rutas`**.
 *
 * Mientras la landing no exista, la raíz sigue enseñando la app — de ahí este
 * archivo, que no es más que un reenvío a `/rutas`.
 *
 * ## La dirección del reenvío es al revés de lo que parece, y a propósito
 *
 * Lo natural sería dejar la app aquí y que `/rutas` reenviara. **Sería la trampa:**
 * el día que este archivo se vuelva la landing, `/rutas` se volvería la landing
 * con él, y el ícono instalado de todos —que apunta a `/rutas`— abriría una
 * portada en vez de su camión.
 *
 * Así que la app vive en `rutas/page.tsx` y es **este** archivo el que se
 * reemplaza. Lo que se borre al escribir la landing no se lleva nada.
 *
 * Lo cuida `direcciones.test.ts`.
 */
export { default, dynamic } from "./rutas/page";
