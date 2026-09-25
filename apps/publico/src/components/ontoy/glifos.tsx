/**
 * **Los glifos del universo** que usa el marco de la app, del paquete de
 * símbolos de `docs/diseno/app-v1/simbolos/`.
 *
 * Van escritos a mano y no importados del `.svg`, por la misma razón que
 * `GlifoIra` (`vista-ira.tsx`): cada archivo del paquete trae ~8 KB de
 * metadatos C2PA contra unos 400 bytes de dibujo. Lo que se copia es el dibujo.
 *
 * **La tinta es `currentColor`** donde el diseño pone `var(--ink)`: carbón de
 * día y hueso de noche, sin una copia por piel. Las pupilas y el color de
 * barrio no cambian con la piel.
 */

const CARBON = "#2A2E37";
const BLANCO = "#fff";

/** `g-aviso`: el letrero en su poste — la puerta a los avisos de tus rutas. */
export function GlifoAviso({ tamano = 30 }: { tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <rect x="11" y="14" width="2" height="6.4" fill="currentColor" />
      <rect x="7.6" y="19.8" width="8.8" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2.6" y="3" width="18.8" height="11.8" rx="2.8" fill="#F2C14E" />
      <circle cx="9.4" cy="8.9" r="2" fill={BLANCO} />
      <circle cx="14.6" cy="8.9" r="2" fill={BLANCO} />
      <circle cx="9.4" cy="8.9" r="1.1" fill={CARBON} />
      <circle cx="14.6" cy="8.9" r="1.1" fill={CARBON} />
    </svg>
  );
}

/** `g-sol`: despierto. Es a donde lleva el renglón cuando la app está de noche. */
export function GlifoSol({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <path
        d="M12 1.6v2.2M12 20.2v2.2M1.6 12h2.2M20.2 12h2.2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5"
        stroke="#F2C14E"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="5.8" fill="#F2C14E" />
      <circle cx="10" cy="11.4" r="1.6" fill={BLANCO} />
      <circle cx="14" cy="11.4" r="1.6" fill={BLANCO} />
      <circle cx="10" cy="11.4" r="0.85" fill={CARBON} />
      <circle cx="14" cy="11.4" r="0.85" fill={CARBON} />
    </svg>
  );
}

/** `g-luna`: dormida. Es a donde lleva el renglón cuando la app está de día. */
export function GlifoLuna({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <path d="M14.8 2.6A9.6 9.6 0 1 0 21.4 15.4 7.6 7.6 0 0 1 14.8 2.6z" fill="#7FB8F0" />
      <path
        d="M5.4 12.6q1.3 1.1 2.6 0M9.4 15.6q1.3 1.1 2.6 0"
        fill="none"
        stroke={CARBON}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
