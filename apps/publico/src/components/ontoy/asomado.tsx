"use client";

/**
 * **Ontoy asomado** — lo que quedó en lugar de la cabecera (ASAV, 25-sep).
 *
 * El diseño de la app no tiene cabecera: cada pantalla abre con su título. Lo
 * que queda arriba es Ontoy **asomándose por el borde, en la esquina derecha**,
 * como si viniera a ver qué haces. Tocarlo lleva a Inicio.
 *
 * ## Cuándo NO sale, y las dos son reglas
 *
 * - **Si la pantalla ya tiene su Ontoy hablando** (regla 3 del diseño: uno por
 *   pantalla). No lo decide cada pantalla: lo decide el CSS con
 *   `.ontoy:has(.ontoy-muneco)`, así que una pantalla nueva con su Ontoy lo
 *   esconde sin que nadie se acuerde. Por eso este dibujo **no** lleva la clase
 *   `ontoy-muneco`: si la llevara se escondería a sí mismo.
 * - **Sobre el Mapa**, donde arriba va el buscador y el mapa es de pantalla
 *   completa. Eso lo decide quien lo monta (`ontoy.tsx`).
 *
 * Escondido no deja la pantalla sin salida (8.10): la barra sigue abajo.
 *
 * ## El dibujo
 *
 * El mismo idioma que el glifo `g-instalar` del diseño —Ontoy asomado por el
 * filo de un teléfono—, volteado hacia abajo: el filo es el de arriba de la
 * pantalla, se ve la mitad de abajo de su cuerpo con los ojos, y las manos
 * flotan a los lados, sin unir al cuerpo, como en todos sus dibujos. Las
 * pupilas miran abajo y hacia adentro: a lo que estás haciendo.
 */
export function Asomado({ alTocar }: { alTocar: () => void }) {
  return (
    <button type="button" className="ontoy-asomado" onClick={alTocar} aria-label="Ir a Inicio">
      <svg viewBox="0 0 76 46" width="76" height="46" aria-hidden="true">
        <path d="M14 0 C13 25 23 40 38 40 C53 40 63 25 62 0 Z" fill="var(--ontoy)" />
        <circle cx="5.5" cy="8" r="5" fill="var(--ontoy)" />
        <circle cx="70.5" cy="8" r="5" fill="var(--ontoy)" />
        <circle cx="31" cy="22" r="7" fill="#fff" />
        <circle cx="46" cy="21" r="7" fill="#fff" />
        <circle cx="28.8" cy="25" r="3.9" fill="#2A2E37" />
        <circle cx="43.8" cy="24" r="3.9" fill="#2A2E37" />
      </svg>
    </button>
  );
}
