/**
 * **Los glifos del universo** que usa el marco de la app, del paquete de
 * símbolos de `docs/diseno/app-v1/simbolos/`.
 *
 * Van escritos a mano y no importados del `.svg`: cada archivo del paquete
 * trae ~8 KB de metadatos C2PA contra unos 400 bytes de dibujo. Lo que se copia
 * es el dibujo.
 *
 * **La tinta es `currentColor`** donde el diseño pone `var(--ink)`: carbón de
 * día y hueso de noche, sin una copia por piel. Las pupilas y el color de
 * barrio no cambian con la piel.
 *
 * **Las pupilas de los objetos van en su propio grupo** (`.glifo-pupilas`),
 * como en `Simbolos.dc.html`: quien los monta las corre con `--mx` para que
 * miren a algún lado. Es la regla 2b de la barra.
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

/** Las pupilas de un objeto: se corren con `--mx` desde el CSS de quien lo monta. */
function Pupilas({ children }: { children: React.ReactNode }) {
  return <g className="glifo-pupilas">{children}</g>;
}

/** `g-casa`: la casita con ojos — Inicio. */
export function GlifoCasa({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <rect x="4.6" y="10" width="14.8" height="11.4" rx="1.8" fill="#E36F8C" />
      <path
        d="M2.4 11.4 11.2 4a1.2 1.2 0 0 1 1.6 0l8.8 7.4c.6.5.2 1.4-.5 1.4H2.9c-.7 0-1.1-.9-.5-1.4z"
        fill="currentColor"
      />
      <rect x="10.4" y="17.6" width="3.2" height="3.8" rx="1" fill="currentColor" />
      <circle cx="8.5" cy="15.2" r="2" fill={BLANCO} />
      <circle cx="15.5" cy="15.2" r="2" fill={BLANCO} />
      <Pupilas>
        <circle cx="8.5" cy="15.2" r="1.1" fill={CARBON} />
        <circle cx="15.5" cy="15.2" r="1.1" fill={CARBON} />
      </Pupilas>
    </svg>
  );
}

/** `g-mapa`: el mapa doblado, con ojos — Mapa. */
export function GlifoMapa({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <path d="M2.4 6.4 8.4 4.2l7.2 2.2 6-2.2v13.4l-6 2.2-7.2-2.2-6 2.2z" fill="#5FB36B" />
      <path d="M8.4 4.2l7.2 2.2v13.6l-7.2-2.2z" fill="#D3E4C9" />
      <circle cx="10.3" cy="11.8" r="1.75" fill={BLANCO} />
      <circle cx="13.7" cy="12.6" r="1.75" fill={BLANCO} />
      <Pupilas>
        <circle cx="10.3" cy="11.8" r="0.95" fill={CARBON} />
        <circle cx="13.7" cy="12.6" r="0.95" fill={CARBON} />
      </Pupilas>
    </svg>
  );
}

/**
 * `g-ira`: Ontoy de gorrito — «Ir a», en la barra y en el buscador.
 *
 * Es un objeto del universo —con ojos y en color de barrio— y no una lupa
 * genérica: el estándar es explícito en que no se usa ninguna fuente de iconos
 * ajena.
 */
export function GlifoIra({ tamano = 26, className }: { tamano?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className={className}>
      <path d="M12 11 7 1.4h10z" fill="#F2C14E" />
      <circle cx="12" cy="14.6" r="7.6" fill={BLANCO} />
      <circle cx="12" cy="14.6" r="6.4" fill="#1E2B4D" />
      <circle cx="3.4" cy="17.8" r="1.7" fill="#1E2B4D" />
      <circle cx="20.6" cy="17.8" r="1.7" fill="#1E2B4D" />
      <circle cx="9.7" cy="13.6" r="1.9" fill={BLANCO} />
      <circle cx="14.3" cy="13.6" r="1.9" fill={BLANCO} />
      <Pupilas>
        <circle cx="9.8" cy="12.9" r="1.05" fill={CARBON} />
        <circle cx="14.4" cy="12.9" r="1.05" fill={CARBON} />
      </Pupilas>
    </svg>
  );
}

/** `g-pase`: la tarjeta con ojos — Pase. */
export function GlifoPase({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <rect x="2.4" y="5.6" width="19.2" height="12.8" rx="2.6" fill="#2FA6A0" />
      <rect x="2.4" y="14.4" width="19.2" height="2" fill="currentColor" />
      <circle cx="9.4" cy="10.2" r="2" fill={BLANCO} />
      <circle cx="14.6" cy="10.2" r="2" fill={BLANCO} />
      <Pupilas>
        <circle cx="9.4" cy="10.2" r="1.1" fill={CARBON} />
        <circle cx="14.6" cy="10.2" r="1.1" fill={CARBON} />
      </Pupilas>
    </svg>
  );
}
