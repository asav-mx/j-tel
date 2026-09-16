import localFont from "next/font/local";
import "@/app/casa/casa.css";

/**
 * El envoltorio del cascarón: la piel y las tres letras del skill vigente.
 *
 * Todo lo que se dibuje con el lenguaje nuevo va dentro de esto, y nada de
 * afuera cambia por ello: los tokens viven en la clase `.cascaron`, no en
 * `:root`, así que redefinir `--tenue` y `--linea` no le mueve un pixel a las
 * pantallas que todavía usan la piel anterior. Ver la cabecera de `casa.css`.
 *
 * Es un componente y no sólo el layout de `/casa` porque el muestrario vive
 * bajo `/jstaff`, fuera del árbol del cascarón, y necesita exactamente la misma
 * envoltura. Tenerla en dos lugares sería tenerla mal en uno de los dos.
 *
 * **Las tres familias se cargan aquí y no en el layout raíz** a propósito:
 * declararlas arriba se las pondría a todas las pantallas, incluidas las que no
 * las usan. El día que no quede nada fuera del cascarón, suben al layout raíz y
 * las cuatro anteriores se borran.
 *
 * Son locales, como las otras, por la razón que cuenta `src/app/fuentes/LEEME.md`:
 * `next/font/google` descarga durante `next build`, así que una falla de red de
 * Google no tumba la tipografía — tumba la compilación. Ya pasó en el #294.
 */

/** Lo que identifica: números económicos, títulos, la marca. */
const titular = localFont({
  src: [{ path: "../../app/fuentes/bricolage-variable.woff2", weight: "700 800", style: "normal" }],
  display: "swap",
  variable: "--letra-titular-cargada",
});

/** Lo que se lee de corrido: frases de apoyo, etiquetas, prosa. */
const lectura = localFont({
  src: [{ path: "../../app/fuentes/inter-variable.woff2", weight: "400 600", style: "normal" }],
  display: "swap",
  variable: "--letra-lectura-cargada",
});

/** Toda medición: edades, horas, porcentajes, IMEIs, folios. */
const medida = localFont({
  src: [
    { path: "../../app/fuentes/jetbrains-mono-variable.woff2", weight: "400 500", style: "normal" },
  ],
  display: "swap",
  variable: "--letra-medida-cargada",
});

export function Cascaron({ children }: { children: React.ReactNode }) {
  return (
    <div className={`cascaron ${titular.variable} ${lectura.variable} ${medida.variable}`}>
      {children}
    </div>
  );
}
