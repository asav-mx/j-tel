"use client";

import { useEffect, useRef } from "react";
import estilos from "./landing.module.css";

/**
 * La escena del landing: una ciudad anónima de noche y cincuenta luces que la
 * recorren. Al cerrar la ventana, cuarenta y siete se apagan y tres se quedan
 * encendidas — que es exactamente lo que el producto hace con un turno.
 *
 * Ninguna ciudad en particular: la retícula se sortea en cada carga. Nada de
 * lo que se dibuja aquí es un dato real, y por eso el landing puede permitirse
 * la animación que el producto tiene prohibida sobre un resultado.
 *
 * Se arma en el navegador y no en el servidor por dos razones: la traza se
 * sortea (dibujarla en el servidor daría un HTML distinto al del cliente) y
 * las animaciones necesitan getTotalLength(), que solo existe una vez montado
 * el SVG.
 */

const DESTINO_X = 905;
const DESTINO_Y = 300;
const NS = "http://www.w3.org/2000/svg";
/** Lado de la manzana, en unidades del viewBox. La retícula se alinea a él. */
const MANZANA = 42;
const MARGEN = 6;
const ANCHO = 1180;
const ALTO = 560;
/** Cuarenta y siete cumplidos, uno no cumplido, dos pendientes. */
const CUMPLIDOS = 47;

export function EscenaCiudad() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const gManzanas = svg.querySelector("#manzanas");
    const gTrazas = svg.querySelector("#trazas");
    const gCabezas = svg.querySelector("#cabezas");
    const gDestino = svg.querySelector("#destino");
    const gEtiquetas = svg.querySelector("#etiquetas");
    if (!gManzanas || !gTrazas || !gCabezas || !gDestino || !gEtiquetas) return;

    const alinear = (v: number) => Math.round(v / MANZANA) * MANZANA;
    const crear = <K extends keyof SVGElementTagNameMap>(
      tag: K,
      attrs: Record<string, string | number>,
    ) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      return el;
    };

    // — La retícula de manzanas —
    const columnas = Math.ceil(ANCHO / MANZANA);
    const filas = Math.ceil(ALTO / MANZANA);
    const ocupado = Array.from({ length: filas }, () => Array(columnas).fill(false));

    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < columnas; c++) {
        if (ocupado[f]![c] || Math.random() < 0.22) continue;
        const ancho = 1 + Math.floor(Math.random() * 3);
        const alto = 1 + Math.floor(Math.random() * 2);

        let libre = true;
        for (let i = 0; i < alto && libre; i++) {
          for (let j = 0; j < ancho && libre; j++) {
            if (f + i >= filas || c + j >= columnas || ocupado[f + i]![c + j]) libre = false;
          }
        }
        if (!libre) continue;
        for (let i = 0; i < alto; i++) {
          for (let j = 0; j < ancho; j++) ocupado[f + i]![c + j] = true;
        }

        const x = c * MANZANA + MARGEN;
        const y = f * MANZANA + MARGEN;
        // El destino se deja despejado: la geocerca tiene que respirar.
        if (Math.hypot(x - DESTINO_X, y - DESTINO_Y) < 90) continue;

        gManzanas.appendChild(
          crear("rect", {
            x,
            y,
            width: ancho * MANZANA - MARGEN * 2,
            height: alto * MANZANA - MARGEN * 2,
            rx: 2,
            fill: `rgba(122,156,184,${(0.018 + Math.random() * 0.03).toFixed(3)})`,
          }),
        );
      }
    }

    /** Un camino de calles: solo tramos rectos y vueltas de noventa grados. */
    const calle = (x0: number, y0: number, x1: number, y1: number) => {
      let cx = alinear(x0);
      let cy = alinear(y0);
      const puntos: Array<[number, number]> = [[cx, cy]];
      let horizontal = Math.abs(x1 - x0) > Math.abs(y1 - y0);
      const codos = 3 + Math.floor(Math.random() * 3);

      for (let i = 1; i <= codos; i++) {
        const t = i / (codos + 1);
        if (horizontal) cx = alinear(x0 + (x1 - x0) * t + (Math.random() - 0.5) * MANZANA * 3);
        else cy = alinear(y0 + (y1 - y0) * t + (Math.random() - 0.5) * MANZANA * 3);
        puntos.push([cx, cy]);
        horizontal = !horizontal;
      }
      puntos.push([cx, y1]);
      puntos.push([x1, y1]);
      return `M${puntos.map((p) => `${p[0]} ${p[1]}`).join(" L")}`;
    };

    /** Una unidad: su rastro y la cabeza de luz que lo va dejando. */
    const agregarUnidad = (
      d: string,
      color: string,
      ancho: number,
      retraso: string,
      reposo: string,
      anchoCabeza: number,
    ) => {
      const rastro = crear("path", { d, stroke: color, "stroke-width": ancho });
      rastro.setAttribute("class", estilos.traza);
      rastro.style.setProperty("--d", `${retraso}s`);
      rastro.style.setProperty("--reposo", reposo);
      gTrazas.appendChild(rastro);

      const largo = rastro.getTotalLength();
      rastro.style.setProperty("--len", largo.toFixed(1));

      const cabeza = crear("path", { d, stroke: color, "stroke-width": anchoCabeza });
      cabeza.setAttribute("class", estilos.cabeza);
      cabeza.style.setProperty("--d", `${retraso}s`);
      cabeza.style.setProperty("--cab", `46 ${(largo + 46).toFixed(1)}`);
      cabeza.style.setProperty("--len2", largo.toFixed(1));
      gCabezas.appendChild(cabeza);
    };

    // — Los orígenes: la ciudad entera converge al mismo destino —
    const origenes: Array<[number, number]> = [];
    for (let i = 0; i < 20; i++) origenes.push([-20, 30 + i * 26]);
    for (let i = 0; i < 16; i++) origenes.push([50 + i * 54, -20]);
    for (let i = 0; i < 14; i++) origenes.push([60 + i * 58, 580]);

    // Los cumplidos van en acero —son medición, no juicio— y se apagan casi del
    // todo al cerrar la ventana. Solo las tres excepciones conservan su color.
    origenes.slice(0, CUMPLIDOS).forEach((o) => {
      const a = Math.random() * Math.PI * 2;
      agregarUnidad(
        calle(o[0], o[1], DESTINO_X + Math.cos(a) * 18, DESTINO_Y + Math.sin(a) * 18),
        "var(--acero)",
        1.3,
        (Math.random() * 3.4).toFixed(2),
        ".13",
        2.6,
      );
    });

    // La que no llegó a destino: su traza se corta a media ciudad.
    agregarUnidad(calle(-20, 480, 452, 378), "var(--rojo)", 2.4, "1.1", ".95", 3.6);
    // Las dos que sí llegaron pero no se pueden afirmar.
    agregarUnidad(calle(160, 580, 886, 322), "var(--ambar)", 2.2, "1.9", ".9", 3.4);
    agregarUnidad(calle(-20, 96, 890, 282), "var(--ambar)", 2.2, "3.4", ".9", 3.4);

    // — El destino: la geocerca —
    const geo = { fill: "none", stroke: "var(--verde)" };
    const anilloBase = crear("circle", {
      cx: DESTINO_X,
      cy: DESTINO_Y,
      r: 32,
      ...geo,
      "stroke-width": 1.5,
    });
    anilloBase.setAttribute("class", estilos.geo);

    const anilloPulso = crear("circle", {
      cx: DESTINO_X,
      cy: DESTINO_Y,
      r: 32,
      ...geo,
      "stroke-width": 1,
    });
    anilloPulso.setAttribute("class", estilos.pulso);

    const centro = crear("circle", {
      cx: DESTINO_X,
      cy: DESTINO_Y,
      r: 4.5,
      fill: "var(--verde)",
    });
    centro.setAttribute("class", estilos.geo);

    const rotulo = crear("text", {
      x: DESTINO_X,
      y: DESTINO_Y - 48,
      "text-anchor": "middle",
      fill: "var(--tenue)",
      "font-family": "var(--fuente-mono)",
      "font-size": 11,
      "letter-spacing": 2,
    });
    rotulo.setAttribute("class", estilos.geo);
    rotulo.textContent = "DESTINO";

    gDestino.append(anilloBase, anilloPulso, centro, rotulo);

    // — Las tres que se quedan encendidas, cada una con su medida —
    const etiqueta = (x: number, y: number, texto: string, color: string) => {
      const e = crear("text", {
        x,
        y,
        fill: color,
        "font-family": "var(--fuente-mono)",
        "font-size": 12,
        "letter-spacing": 1.2,
      });
      e.setAttribute("class", estilos.etq);
      e.textContent = texto;
      gEtiquetas.appendChild(e);
    };

    etiqueta(470, 366, "NO CUMPLIDO — no llegó a destino", "var(--rojo)");
    etiqueta(560, 490, "PENDIENTE — sin señal 46 min", "var(--ambar)");
    etiqueta(420, 178, "TARDE — 2:14 fuera de tolerancia", "var(--ambar)");

    return () => {
      for (const g of [gManzanas, gTrazas, gCabezas, gDestino, gEtiquetas]) {
        g.replaceChildren();
      }
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      role="img"
      aria-label="Una ciudad anónima de noche; cincuenta luces la recorren hacia el destino y solo tres quedan encendidas."
    >
      <defs>
        <filter id="brillo" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={ANCHO} height={ALTO} fill="#07090C" />
      <g id="manzanas" />
      <g id="trazas" />
      <g id="cabezas" filter="url(#brillo)" />
      <g id="destino" />
      <g id="etiquetas" />
    </svg>
  );
}
