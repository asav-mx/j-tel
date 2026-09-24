"use client";

import { useEffect, useId, useState } from "react";
import { textoSobreLaRuta } from "@/lib/ontoy/tinte-de-ruta";

/**
 * **«Tu ruta, tu color»** — la sección que le habla al concesionario.
 *
 * Escoges un color de la lista y **el sitio entero se tiñe**: Cami, Tino, las
 * placas, el camión de la calle de arriba. Es la demostración de que el color
 * de una ruta no es un detalle de la app sino la misma identidad que va
 * pintada en el camión.
 *
 * ## Lo que esta sección YA NO hace, y es casi todo lo que hacía
 *
 * El prototipo traía una función `ajusta()` que le movía el tono al color
 * escogido: si caía cerca del naranja lo empujaba a rojo o a amarillo, si salía
 * muy claro lo oscurecía, si salía muy oscuro lo aclaraba. Y lo explicaba con
 * una nota: «lo ajustamos para que lo reconozcas igual que en la calle».
 *
 * **La enmienda (a) del 23-sep lo deja sin efecto, con todas sus letras:**
 * «Nada se corrige al dibujar. Ni corrimiento de tono, ni luz, ni saturación.
 * Lo que se capturó es lo que se pinta. Si escribes código: no hay función que
 * le mueva el color a una ruta, y no se debe escribir.»
 *
 * Así que aquí no hay `ajusta()`, ni nota, ni la flecha que enseñaba el color
 * de antes y el de después. **Lo que se escoge es lo que se pinta.**
 *
 * Y por eso tampoco está el selector de color libre ni el botón «¿y si le pongo
 * naranja?»: lo que sostiene que el naranja sea sólo de Ontoy no es corregir al
 * que lo elija, es **no ofrecerlo**. La lista de J-Staff no trae tonos que
 * peleen con él, y esta lista es esa lista.
 *
 * ## El texto sobre el color sí se escoge, y eso la enmienda sí lo deja
 *
 * «Texto **sobre** el color: blanco o carbón según contraste» es lo único que
 * la enmienda conserva, porque no le toca el color a nadie: elige con qué
 * escribir encima. Lo resuelve `textoSobreLaRuta`, que ya existe en el repo y
 * garantiza 4.5:1 cayendo a blanco o negro puros cuando los de la piel no
 * llegan.
 */

/**
 * La lista. Son los cinco del prototipo **menos el azul noche**, que el
 * prototipo traía de sexto.
 *
 * El azul noche (`#1E2B4D`) no es un color libre: en este universo es **el
 * color del pasajero** —«tú estás aquí»— y el de la piel oscura. Una ruta de
 * ese color pintaría a Tino y a Cami del mismo tono que el muñequito que marca
 * dónde estás parado, y el color dejaría de decir de quién es cada cosa.
 *
 * ⚠ Es una decisión mía sobre la lista del prototipo; si lo quieres de vuelta,
 * es un renglón.
 */
const COLORES = [
  { hex: "#4F7FD8", nombre: "Azul" },
  { hex: "#8B6CC9", nombre: "Morado" },
  { hex: "#2FA6A0", nombre: "Agua" },
  { hex: "#E36F8C", nombre: "Rosa" },
  { hex: "#5FB36B", nombre: "Verde" },
];

export function TuColor() {
  const [color, setColor] = useState(COLORES[0].hex);
  const [numero, setNumero] = useState("51");
  const idNumero = useId();

  /*
   * El color se escribe en la variable de la landing entera, no en esta
   * sección: de eso va la promesa de «todo este sitio cambia contigo». Cami en
   * la calle de arriba, Tino, las placas — todos leen `--ruta`.
   */
  useEffect(() => {
    const landing = document.querySelector<HTMLElement>(".landing");
    if (!landing) return;
    landing.style.setProperty("--ruta", color);
    landing.style.setProperty("--sobre-ruta", textoSobreLaRuta(color).color);
  }, [color]);

  /* El número es de la ilustración: tres caracteres, y sin espacios de sobra. */
  const rotulo = numero.trim() || "51";

  return (
    <section id="ruta" className="landing-caja landing-color">
      <div className="landing-color-dicho">
        <p className="landing-rotulo">Para tu concesión, y para ti</p>
        <h2>Tu ruta, tu color.</h2>
        <p className="landing-lead">
          Cada concesión escoge el color de su ruta de una lista, y ese color es{" "}
          <strong>el mismo en la lámina del poste, en la app y pintado en el camión</strong>.
          Escógelo: todo este sitio cambia contigo.
        </p>

        <div className="landing-muestras" role="group" aria-label="Color de la ruta">
          {COLORES.map((c) => (
            <button
              key={c.hex}
              type="button"
              className="landing-muestra"
              style={{ background: c.hex }}
              aria-label={c.nombre}
              aria-pressed={color === c.hex}
              onClick={() => setColor(c.hex)}
            >
              {/*
               * El escogido se marca con una palomita y no sólo con un aro de
               * color: un aro es color sobre color, y quien no distingue los
               * dos tonos se queda sin saber cuál eligió.
               */}
              {color === c.hex && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 12.5 10 17.5 19 7"
                    fill="none"
                    stroke={textoSobreLaRuta(c.hex).color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>

        <p className="landing-nota-color">
          El naranja no está en la lista: es de Ontoy, y de nadie más.
        </p>

        <label className="landing-campo" htmlFor={idNumero}>
          <span>Número de ruta</span>
          <input
            id={idNumero}
            value={numero}
            maxLength={3}
            onChange={(e) => setNumero(e.target.value)}
          />
        </label>
      </div>

      <div className="landing-color-muestra">
        <TinoGrande numero={rotulo} />
        <CamiGrande numero={rotulo} />
      </div>
    </section>
  );
}

/**
 * Tino a tamaño de muestra, con su placa.
 *
 * **«¡ya!» va en blanco y más grande, no en el color de la ruta.** Es la misma
 * corrección que en la calle, por la misma medición: el color de ruta sobre la
 * placa carbón da 3.47:1 con el azul y 3.29 con el morado, contra un piso de
 * 4.5. El prototipo lo resolvía con una versión aclarada del color, que es
 * exactamente el «corrimiento de luz» que la enmienda (a) prohíbe.
 */
function TinoGrande({ numero }: { numero: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-label="Tino, tu parada">
      <rect x="57" y="36" width="6" height="72" fill="var(--carbon)" />
      <rect x="46" y="106" width="28" height="7" rx="3.5" fill="var(--carbon)" />
      <circle cx="60" cy="38" r="26" fill="var(--ruta)" />
      <circle cx="51" cy="36" r="7.5" fill="var(--ojo)" />
      <circle cx="69" cy="36" r="7.5" fill="var(--ojo)" />
      <circle cx="49" cy="37" r="4" fill="var(--pupila)" />
      <circle cx="67" cy="37" r="4" fill="var(--pupila)" />
      <rect x="31" y="70" width="58" height="26" rx="6.5" fill="var(--carbon)" />
      <text x="46" y="87.5" textAnchor="middle" fill="var(--blanco)" style={{ font: "800 11px var(--titular)" }}>
        {numero}
      </text>
      <rect x="58.5" y="76" width="1.4" height="14" fill="var(--blanco)" opacity=".5" />
      <text x="74" y="87.5" textAnchor="middle" fill="var(--blanco)" style={{ font: "800 11px var(--titular)" }}>
        ¡ya!
      </text>
      <circle cx="31" cy="83" r="6" fill="var(--ruta)" />
      <circle cx="89" cy="83" r="6" fill="var(--ruta)" />
    </svg>
  );
}

/**
 * Cami de frente, con su letrero.
 *
 * El letrero va en hueso con el número en carbón —así está dibujado— y no toma
 * el color de la ruta: el color ya lo lleva la carrocería, que es lo que se ve
 * desde lejos en la calle.
 */
function CamiGrande({ numero }: { numero: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-label="Cami, tu camión">
      <rect x="32" y="90" width="14" height="12" rx="4" fill="var(--carbon)" />
      <rect x="74" y="90" width="14" height="12" rx="4" fill="var(--carbon)" />
      <rect x="26" y="14" width="68" height="80" rx="16" fill="var(--ruta)" />
      <rect x="40" y="19" width="40" height="13" rx="4" fill="var(--hueso)" />
      <text x="60" y="29.5" textAnchor="middle" fill="var(--carbon)" style={{ font: "800 10px var(--titular)" }}>
        {numero}
      </text>
      <rect x="32" y="36" width="56" height="30" rx="10" fill="var(--carbon)" />
      {/* Los ojos ovalados son de Cami: así se distingue de Tino, que los tiene redondos. */}
      <ellipse cx="49" cy="51" rx="9.5" ry="7" fill="var(--ojo)" />
      <ellipse cx="71" cy="51" rx="9.5" ry="7" fill="var(--ojo)" />
      <ellipse cx="47" cy="51" rx="4.4" ry="4.6" fill="var(--pupila)" />
      <ellipse cx="69" cy="51" rx="4.4" ry="4.6" fill="var(--pupila)" />
      <circle cx="42" cy="78" r="6" fill="var(--hueso)" />
      <circle cx="78" cy="78" r="6" fill="var(--hueso)" />
    </svg>
  );
}
