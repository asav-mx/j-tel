"use client";

import { useEffect, useRef } from "react";
import { useNivel } from "../nivel-contexto";
import { MS_POR_CUADRO } from "../nivel-de-rendimiento";
import {
  animoDeTino,
  avanzarLaCalle,
  calleNueva,
  loQueDiceLaPlaca,
  PARADA_X,
  type Vehiculo,
} from "./trafico";

/**
 * **La avenida del hero.** Una franja de calle cruzando el ancho de la página,
 * debajo del nombre: dos carriles, siete coches, Cami, una obra que se cambia
 * de sitio, Tino en su parada y tres pasajeros que se suben cuando llega.
 *
 * Es la ilustración de lo que Ontoy mira todo el día, y es **ilustración**: no
 * hay aquí ninguna ruta real, ningún dato leído y nada que un pasajero pueda
 * confundir con información de su camión. La única frase que afirma algo es la
 * placa de Tino, y por eso vive en `trafico.ts` con sus pruebas.
 *
 * ## Los dos mundos de color, que aquí se ven de un vistazo
 *
 * Los coches, la obra, la banqueta y los pasajeros van en **neutros y colores
 * de barrio**. El **color de ruta** lo llevan sólo Cami y Tino, que son los que
 * pertenecen a una ruta. Y el **naranja no aparece**: es de Ontoy y de nadie
 * más, y Ontoy no está en la calle.
 *
 * ## Cómo se mueve
 *
 * Un bucle escribe los `transform` **por referencia**, como el hero: React
 * renderiza los dibujos una vez y no vuelve a enterarse. Las piezas se
 * encuentran por `data-pieza` al montar, en vez de pasar treinta `ref`.
 *
 * Con `prefers-reduced-motion` **no hay bucle**: la calle se queda como un
 * dibujo quieto, que es exactamente lo que pidió quien lo pidió.
 *
 * ## Se ancla a la DERECHA, y ésa es la decisión de encuadre
 *
 * En pantalla angosta no cabe la calle entera y hay que recortar de algún lado.
 * Centrada —lo natural— el teléfono se queda con el tramo de en medio: puros
 * coches. **Tino, sus tres pasajeros y la placa viven en el extremo derecho**, y
 * son lo único de la escena que cuenta algo. Anclada a la derecha, el teléfono
 * ve la parada y lo que se pierde es asfalto.
 */
export function Calle() {
  const { nivel, quieto } = useNivel();
  const lienzo = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (quieto) return;
    const svg = lienzo.current;
    if (!svg) return;

    const pieza = (n: string) =>
      svg.querySelector<SVGElement>(`[data-pieza="${n}"]`);
    const piezas = {
      coches: Array.from({ length: 7 }, (_, i) => pieza(`coche-${i}`)),
      cami: pieza("cami"),
      mancha: pieza("mancha"),
      conos: [pieza("cono-0"), pieza("cono-1")],
      trabajador: pieza("trabajador"),
      martillo: pieza("martillo"),
      tino: pieza("tino"),
      tinoFeliz: pieza("tino-feliz"),
      tinoTriste: pieza("tino-triste"),
      placa: pieza("placa"),
      placaFondo: pieza("placa-fondo"),
      placaFranja: pieza("placa-franja"),
      pasajeros: [
        pieza("pasajero-0"),
        pieza("pasajero-1"),
        pieza("pasajero-2"),
      ],
    };

    const calle = calleNueva();
    const minimoEntreCuadros = MS_POR_CUADRO[nivel];
    const arranque = performance.now();
    let anterior = arranque;
    let raf = 0;
    /* El ánimo se suaviza: Tino no cambia de cara de golpe. */
    let animo = 0;
    let dichoAntes = "";

    /** Dónde y cómo se dibuja un vehículo, a partir de su carril y su posición. */
    const donde = (v: Vehiculo) => {
      const y = 44 + 53 * v.carril + (v.esCami ? -6 : 8);
      /* Al cambiarse de carril se inclina un poco: sin eso, patina de lado. */
      const giro = (v.carrilDestino - v.carril) * 14;
      const centro = v.esCami ? 45 : 32;
      return `translate(${v.x.toFixed(1)} ${y.toFixed(1)}) rotate(${giro.toFixed(1)} ${centro} 20)${
        v.esCami ? " scale(.75)" : ""
      }`;
    };

    /** Un paso suave entre 0 y 1, para que la obra aparezca y se vaya sin parpadear. */
    const suave = (x: number) => {
      const c = Math.max(0, Math.min(1, x));
      return c * c * (3 - 2 * c);
    };

    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro);
      const desde = ahora - anterior;
      if (desde < minimoEntreCuadros) return;
      const dt = Math.min(0.05, desde / 1000);
      anterior = ahora;
      const t = (ahora - arranque) / 1000;

      avanzarLaCalle(calle, dt, t);

      piezas.cami?.setAttribute("transform", donde(calle.vehiculos[0]));
      piezas.coches.forEach((g, i) =>
        g?.setAttribute("transform", donde(calle.vehiculos[i + 1])),
      );

      /* La obra: aparece, trabaja un rato, deja la mancha y se va. */
      const ct = calle.obraEnSuCiclo;
      const X = calle.obraX;
      const Y = calle.obraCarril ? 123 : 70;
      const conos = suave((ct - 8) / 0.8) * (1 - suave((ct - 24.2) / 0.8));
      const quien = suave((ct - 9) / 0.7) * (1 - suave((ct - 23.4) / 0.8));
      piezas.mancha?.setAttribute("cx", String(X));
      piezas.mancha?.setAttribute("cy", String(Y));
      piezas.mancha?.setAttribute(
        "opacity",
        (suave((ct - 8.6) / 0.6) * (1 - suave((ct - 21.5) / 1.6))).toFixed(2),
      );
      piezas.conos[0]?.setAttribute(
        "transform",
        `translate(${X - 70} ${Y + 22}) scale(${conos.toFixed(3)})`,
      );
      piezas.conos[1]?.setAttribute(
        "transform",
        `translate(${X + 70} ${Y + 22}) scale(${conos.toFixed(3)})`,
      );
      piezas.trabajador?.setAttribute(
        "transform",
        `translate(${(X + 36 + (1 - quien) * 30).toFixed(1)} ${Y + 22}) scale(${(quien * 0.9).toFixed(3)})`,
      );
      const martillando = ct > 10 && ct < 21.5;
      piezas.martillo?.setAttribute(
        "transform",
        `rotate(${martillando ? (Math.sin(t * 11) * 28 - 10).toFixed(1) : 0} -18 0)`,
      );

      /* Tino: su cara, su brinco y su placa. */
      const quiere = animoDeTino(calle.parada);
      animo += (quiere - animo) * 0.08;
      const brinco = calle.parada.enLaParada
        ? -Math.abs(Math.sin(t * 7)) * (calle.seTardo ? 5 : 3)
        : 0;
      const agache = Math.max(0, -animo) * 2.5;
      piezas.tino?.setAttribute(
        "transform",
        `translate(0 ${(brinco + agache).toFixed(1)}) rotate(${(Math.max(0, -animo) * -6).toFixed(1)} 930 43)`,
      );
      piezas.tinoFeliz?.setAttribute("opacity", Math.max(0, animo).toFixed(2));
      piezas.tinoTriste?.setAttribute(
        "opacity",
        Math.max(0, -animo).toFixed(2),
      );

      /*
       * La placa. El texto sólo se toca cuando cambia: escribir `textContent`
       * en cada cuadro rehace el nodo de texto sesenta veces por segundo para
       * dejar la misma frase.
       */
      const dicho = loQueDiceLaPlaca(calle.parada);
      if (dicho !== dichoAntes) {
        dichoAntes = dicho;
        const esYa = dicho === "¡ya!";
        /* La placa se encoge para «¡ya!», que es mucho más corto. */
        const ancho = esYa ? 30 : 62;
        piezas.placaFondo?.setAttribute("width", String(ancho));
        piezas.placaFranja?.setAttribute("width", String(ancho));
        if (piezas.placa) {
          piezas.placa.textContent = dicho;
          piezas.placa.setAttribute("x", String(948 + ancho / 2));
          /*
           * **El texto de la placa va SIEMPRE en blanco**, también en «¡ya!»
           * (enmienda (f), decisión de ASAV del 24-sep). El color de la ruta
           * vive en la franja de 3 px del filo de abajo.
           *
           * La regla vieja —«en ¡ya! el texto va en el color de la ruta»— no se
           * podía cumplir: sobre la placa carbón el azul da 3.47:1 y el morado
           * 3.29, contra un piso de 4.5, y **ninguno de los cinco de la lista
           * llega**. Blanco sobre carbón da 13.6.
           *
           * «¡ya!» sigue destacando, por tamaño.
           */
          piezas.placa.style.fontSize = esYa ? "11px" : "8px";
        }
      }

      /* Los tres pasajeros: esperan, saludan si lo ven venir, y se suben. */
      piezas.pasajeros.forEach((g, i) => {
        if (!g) return;
        const base = 888 - i * 15;
        let x = base;
        let y = 41;
        let opacidad = 1;

        if (calle.parada.enLaParada && calle.esperandoDesde != null) {
          /* Se suben en fila, uno cada 0.7 s, con su saltito al subir. */
          const q = suave((t - calle.esperandoDesde - 0.3 - i * 0.7) / 0.8);
          x = base + (866 - base) * q;
          y = 41 + 12 * q - Math.sin(q * Math.PI) * 6;
          opacidad = 1 - suave((q - 0.8) / 0.2);
        } else if (calle.yaParo) {
          /* Y los siguientes van llegando a la parada después de que se fue. */
          const q = suave((t - calle.saliaEn - 3 - i * 1.4) / 1.8);
          x = base - 110 * (1 - q);
          opacidad = q;
          y = 41 - Math.abs(Math.sin(t * 9 + i)) * 1.5 * (1 - q);
        } else {
          /* Esperando: el balanceo mínimo de estar parado. */
          y = 41 - Math.abs(Math.sin(t * 2 + i * 1.3)) * 0.8;
        }

        g.setAttribute(
          "transform",
          `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
        );
        g.setAttribute("opacity", opacidad.toFixed(2));
        const manos = g.querySelector<SVGElement>("[data-pieza='manos']");
        /* Saludan cuando lo ven venir; las bajan cuando se tarda. */
        const alto = calle.parada.llegando
          ? -6 - Math.abs(Math.sin(t * 10 + i)) * 3
          : calle.parada.seTarda
            ? 2
            : 0;
        manos?.setAttribute("transform", `translate(0 ${alto.toFixed(1)})`);
      });
    };

    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [nivel, quieto]);

  return (
    <div className="landing-calle" aria-hidden="true">
      <svg
        ref={lienzo}
        viewBox="0 0 1200 150"
        preserveAspectRatio="xMaxYMid slice"
      >
        {/* La banqueta, con su filo. */}
        <rect x="-200" y="0" width="1600" height="42" fill="var(--arena)" />
        <rect x="-200" y="41" width="1600" height="3" fill="var(--arena-2)" />

        {/* La raya de en medio. */}
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={i}
            x={20 + i * 110}
            y="95"
            width="50"
            height="4"
            rx="2"
            fill="var(--calle-linea)"
            opacity=".8"
          />
        ))}

        <Obra />

        {COLORES_DE_LOS_COCHES.map((color, i) => (
          <Coche key={i} indice={i} color={color} />
        ))}

        <Cami />

        {COLORES_DE_LOS_PASAJEROS.map((color, i) => (
          <Pasajero key={i} indice={i} color={color} />
        ))}

        <Tino />
      </svg>
    </div>
  );
}

/**
 * Los siete coches son el mismo dibujo con distinta carrocería, y **todos
 * neutros**: los objetos sin ruta no llevan color de ruta, y el naranja es de
 * Ontoy. Un coche de color de ruta diría que ese coche es de esa ruta.
 */
const COLORES_DE_LOS_COCHES = [
  "var(--arena)",
  "var(--carbon)",
  "var(--hueso)",
  "var(--arena-2)",
  "var(--arena-2)",
  "var(--carbon-2)",
  "var(--arena)",
];

/** Los pasajeros van en azul noche, maíz y arena. Nunca en color de ruta: no son de una ruta. */
const COLORES_DE_LOS_PASAJEROS = [
  "var(--pasajero)",
  "var(--maiz)",
  "var(--arena)",
];

function Coche({ indice, color }: { indice: number; color: string }) {
  return (
    <g data-pieza={`coche-${indice}`} transform="translate(-300 52)">
      <rect x="0" y="10" width="64" height="22" rx="9" fill={color} />
      <path d="M14 10 Q18 0 30 0 H42 Q52 0 56 10 Z" fill={color} />
      <rect
        x="20"
        y="3"
        width="12"
        height="8"
        rx="2"
        fill="var(--carbon)"
        opacity=".85"
      />
      <rect
        x="35"
        y="3"
        width="13"
        height="8"
        rx="2"
        fill="var(--carbon)"
        opacity=".85"
      />
      <rect x="58" y="16" width="6" height="5" rx="2" fill="var(--maiz)" />
      <circle cx="15" cy="33" r="7" fill="var(--llanta)" />
      <circle cx="15" cy="33" r="2.6" fill="var(--gris)" />
      <circle cx="50" cy="33" r="7" fill="var(--llanta)" />
      <circle cx="50" cy="33" r="2.6" fill="var(--gris)" />
    </g>
  );
}

/** Cami: el camión, con el color de su ruta y su letrero. El único que se para. */
function Cami() {
  return (
    <g data-pieza="cami" transform="translate(-300 38) scale(.75)">
      <rect x="0" y="12" width="120" height="44" rx="12" fill="var(--ruta)" />
      <rect x="0" y="42" width="120" height="4" fill="var(--hueso)" />
      <rect x="10" y="19" width="18" height="16" rx="4" fill="var(--carbon)" />
      <rect x="33" y="19" width="18" height="16" rx="4" fill="var(--carbon)" />
      <rect x="56" y="19" width="18" height="16" rx="4" fill="var(--carbon)" />
      <rect x="84" y="17" width="28" height="22" rx="6" fill="var(--carbon)" />
      {/* Los ojos ovalados son de Cami: así se distingue de los demás. */}
      <ellipse cx="92" cy="28" rx="5" ry="3.8" fill="var(--ojo)" />
      <ellipse cx="104" cy="28" rx="5" ry="3.8" fill="var(--ojo)" />
      <circle cx="94" cy="28" r="2.2" fill="var(--pupila)" />
      <circle cx="106" cy="28" r="2.2" fill="var(--pupila)" />
      <circle cx="26" cy="58" r="9" fill="var(--llanta)" />
      <circle cx="26" cy="58" r="3.5" fill="var(--hueso)" />
      <circle cx="94" cy="58" r="9" fill="var(--llanta)" />
      <circle cx="94" cy="58" r="3.5" fill="var(--hueso)" />
      {/*
       * El letrero con el número. Es la 51 del universo de Ontoy — la ruta de
       * ejemplo dibujada, no una ruta de nadie.
       */}
      <rect x="84" y="3" width="28" height="12" rx="3" fill="var(--carbon)" />
      <text
        x="98"
        y="12.4"
        textAnchor="middle"
        fill="var(--blanco)"
        style={{ font: "800 9.5px var(--titular)" }}
      >
        51
      </text>
    </g>
  );
}

function Pasajero({ indice, color }: { indice: number; color: string }) {
  return (
    <g
      data-pieza={`pasajero-${indice}`}
      transform={`translate(${888 - indice * 15} 41)`}
    >
      <rect x="-6" y="-16" width="12" height="15" rx="6" fill={color} />
      <circle cx="-2.6" cy="-11" r="2.3" fill="var(--ojo)" />
      <circle cx="2.6" cy="-11" r="2.3" fill="var(--ojo)" />
      <circle cx="-3.3" cy="-11" r="1.2" fill="var(--pupila)" />
      <circle cx="1.9" cy="-11" r="1.2" fill="var(--pupila)" />
      {/* Las manos flotantes, que es como se saluda en este universo. */}
      <g data-pieza="manos">
        <circle cx="-9.5" cy="-7" r="2.3" fill={color} />
        <circle cx="9.5" cy="-7" r="2.3" fill={color} />
      </g>
    </g>
  );
}

/**
 * Tino, la parada — antes Paradito (su id interno sigue siendo ése).
 *
 * Toma el **color de su ruta**, como Cami. Su cara dice lo que sabe: contento
 * cuando lo ve venir, triste cuando se tarda. **Nunca es una alarma**: que se
 * ponga triste es el gesto de quien espera, no un letrero rojo.
 *
 * La placa nace en «a 4 paradas», que es lo más ancho que va a decir: así el
 * primer cuadro no cambia de tamaño delante de nadie.
 */
function Tino() {
  return (
    <g data-pieza="tino">
      <rect x="928" y="16" width="4" height="27" fill="var(--carbon)" />
      <rect x="920" y="41" width="20" height="4" rx="2" fill="var(--carbon)" />
      <circle cx={PARADA_X + 12} cy="16" r="13" fill="var(--ruta)" />
      <circle cx="925" cy="14" r="3.6" fill="var(--ojo)" />
      <circle cx="935" cy="14" r="3.6" fill="var(--ojo)" />
      <circle cx="923" cy="14" r="2" fill="var(--pupila)" />
      <circle cx="933" cy="14" r="2" fill="var(--pupila)" />
      <path
        data-pieza="tino-feliz"
        d="M925 20.5 q5 4.5 10 0"
        stroke="var(--carbon)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        opacity="0"
      />
      <path
        data-pieza="tino-triste"
        d="M925.5 23.5 q4.5 -3.8 9 0"
        stroke="var(--carbon)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        opacity="0"
      />
      {/*
       * La placa dice PARADAS y no minutos, y escribe la unidad. Por eso es más
       * ancha que la del prototipo, que cabía porque decía «3′».
       */}
      {/*
       * La franja del color de la ruta, en el filo de abajo (enmienda (f)).
       * Va DETRÁS de la placa y asomando 3 px: así la placa no necesita un
       * segundo rectángulo que la recorte, y la franja se estira con ella.
       */}
      <rect data-pieza="placa-franja" x="948" y="29" width="62" height="3" rx="1.5" fill="var(--ruta)" />
      <rect
        data-pieza="placa-fondo"
        x="948"
        y="19"
        width="62"
        height="13"
        rx="3"
        fill="var(--carbon)"
      />
      <text
        data-pieza="placa"
        x="979"
        y="28.6"
        textAnchor="middle"
        fill="var(--blanco)"
        style={{ font: "800 8px var(--titular)" }}
      >
        a 4 paradas
      </text>
    </g>
  );
}

/** La obra: su mancha, sus dos conos y quien la trabaja, con su martillo. */
function Obra() {
  return (
    <g>
      <ellipse
        data-pieza="mancha"
        cx="700"
        cy="70"
        rx="30"
        ry="8"
        fill="var(--llanta)"
        opacity="0"
      />
      {[0, 1].map((i) => (
        <g
          key={i}
          data-pieza={`cono-${i}`}
          transform="translate(-300 0) scale(0)"
        >
          <rect
            x="-14"
            y="-4"
            width="28"
            height="5"
            rx="2"
            fill="var(--carbon)"
          />
          <path d="M-11 -3 L-4 -34 L4 -34 L11 -3 Z" fill="var(--maiz)" />
          <rect x="-8.2" y="-20" width="16.4" height="5" fill="var(--hueso)" />
          <circle cx="-3.2" cy="-26" r="2.8" fill="var(--ojo)" />
          <circle cx="3.2" cy="-26" r="2.8" fill="var(--ojo)" />
          <circle cx="-3.2" cy="-26" r="1.5" fill="var(--pupila)" />
          <circle cx="3.2" cy="-26" r="1.5" fill="var(--pupila)" />
        </g>
      ))}
      <g data-pieza="trabajador" transform="translate(-300 0) scale(0)">
        <ellipse cx="-6" cy="-2" rx="4.5" ry="2.6" fill="var(--carbon)" />
        <ellipse cx="6" cy="-2" rx="4.5" ry="2.6" fill="var(--carbon)" />
        <circle cx="0" cy="-17" r="13" fill="var(--nopal)" />
        <path d="M-12 -23 A12 12 0 0 1 12 -23 Z" fill="var(--maiz)" />
        <rect
          x="-15"
          y="-24.5"
          width="30"
          height="3.5"
          rx="1.7"
          fill="var(--maiz)"
        />
        <circle cx="-4.5" cy="-14" r="3.6" fill="var(--ojo)" />
        <circle cx="4.5" cy="-14" r="3.6" fill="var(--ojo)" />
        <circle cx="-4.5" cy="-14" r="1.9" fill="var(--pupila)" />
        <circle cx="4.5" cy="-14" r="1.9" fill="var(--pupila)" />
        <circle cx="16" cy="-9" r="4.2" fill="var(--nopal)" />
        <g data-pieza="martillo">
          <rect
            x="-22"
            y="-16"
            width="3"
            height="16"
            rx="1.5"
            fill="var(--madera)"
          />
          <rect
            x="-27"
            y="-19"
            width="13"
            height="6"
            rx="2"
            fill="var(--carbon)"
          />
          <circle cx="-18" cy="0" r="4.2" fill="var(--nopal)" />
        </g>
      </g>
    </g>
  );
}
