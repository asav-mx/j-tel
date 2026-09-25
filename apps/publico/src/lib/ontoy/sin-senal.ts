/**
 * **SIN SEÑAL** — lo que la pantalla completa necesita saber, sin pantalla.
 *
 * La pantalla (`app/sin-senal`) la sirve el service worker **en lugar del
 * dinosaurio del navegador**: cuando una página no abre sin red y no hay copia
 * guardada de ella (decisión de ASAV, 25-sep-2026). Dentro de la app no sale:
 * ahí, si se cae lo vivo, Inicio pone su línea arriba y deja las rutas a la
 * vista, porque taparlas le quitaría al pasajero lo que todavía le sirve.
 */

/** Dónde vive la pantalla. `sw.js` escribe la misma cadena; `sw.test.ts` las compara. */
export const DIRECCION_SIN_SENAL = "/sin-senal";

/**
 * Lo que la pantalla ofrece como «lo último que supe»: la copia guardada de la
 * app. Trae las rutas y su promesa publicada, **nunca camiones** — lo vivo no
 * se guarda (`sw.js`, regla 3).
 */
export const LO_ULTIMO_QUE_SUPE = "/rutas";

/**
 * A dónde regresar cuando vuelva la señal: la página que el pasajero pidió.
 *
 * Viaja en la dirección (`?desde=`), así que se revisa: sólo una ruta de este
 * mismo sitio. `//otro.sitio` es una ruta para el navegador y un salto a otro
 * dominio para cualquiera que la arme a mano; y volver a esta misma pantalla
 * sería un lazo. Todo lo demás regresa a la app.
 */
export function aDondeRegresar(desde: string | null): string {
  if (!desde || !desde.startsWith("/") || desde.startsWith("//") || desde.startsWith("/\\")) {
    return LO_ULTIMO_QUE_SUPE;
  }
  if (desde === DIRECCION_SIN_SENAL || desde.startsWith(`${DIRECCION_SIN_SENAL}?`)) return LO_ULTIMO_QUE_SUPE;
  return desde;
}

/**
 * «de hace 2 min» — de cuándo es la copia guardada.
 *
 * Sale de la cabecera `Date` de la copia, que es cuándo el servidor la armó, y
 * no de cuándo se guardó: una copia servida de la caché del navegador podría
 * guardarse hoy siendo de ayer. Sin fecha legible, `null`, y la pantalla no
 * dice edad: **mejor callarla que inventarla**.
 *
 * Una fecha en el futuro (el reloj del teléfono atrasado) se dice «de hace un
 * momento»: es lo más reciente que puede ser, y un «de hace −3 min» sólo
 * enseña que algo está roto.
 */
export function edadDeLaCopia(fecha: string | null, ahora: Date): string | null {
  if (!fecha) return null;
  const desde = new Date(fecha);
  if (Number.isNaN(desde.getTime())) return null;
  const minutos = Math.floor((ahora.getTime() - desde.getTime()) / 60_000);
  if (minutos < 1) return "de hace un momento";
  if (minutos < 60) return `de hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `de hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "de hace 1 día" : `de hace ${dias} días`;
}

/**
 * Las palabras de la pantalla, según haya o no una copia.
 *
 * **Sin copia no se promete nada** (ASAV, 25-sep): «te enseño lo último que
 * supe» sobre algo que nunca supimos sería mentir con buenos modales. El botón
 * entonces vuelve a pedir la página, que es lo único que puede servir.
 */
export function palabrasSinSenal(
  copia: { edad: string | null } | null,
  desde: string,
): { ayuda: string; boton: { texto: string; a: string } } {
  if (!copia) {
    return {
      ayuda: "Todavía no tengo nada guardado. Cuando vuelva la señal, me actualizo solo.",
      boton: { texto: "Volver a intentar", a: desde },
    };
  }
  const loUltimo = copia.edad ? `Te enseño lo último que supe, ${copia.edad}.` : "Te enseño lo último que supe.";
  return {
    ayuda: `${loUltimo} Cuando vuelva la señal, me actualizo solo.`,
    boton: { texto: "Ver lo último que supe", a: LO_ULTIMO_QUE_SUPE },
  };
}
