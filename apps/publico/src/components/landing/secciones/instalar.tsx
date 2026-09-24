"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * **«Instalar»** — la última sección, y la que cierra la portada con la
 * promesa más honesta que tiene.
 *
 * Dice tres cosas, en este orden:
 *
 *  1. Las apps de tienda **todavía no están**.
 *  2. Ontoy **ya funciona** en el navegador, sin cuenta y sin descargar nada.
 *  3. Y que cuando no hay corridas, **Ontoy duerme** — con lo que eso
 *     significa.
 *
 * ## La nota de Ontoy dormido es la ley 8.9 en una frase
 *
 * > «Cuando no hay corridas, Ontoy descansa. **Ojos cerrados = no hay dato, no
 * > que no venga.**»
 *
 * Es la escalera de estados dicha para un pasajero: cuando el dato vivo no
 * alcanza, la app degrada por su escalera declarada y **jamás inventa una
 * llegada**. Un camión con dato viejo se queda como dato viejo, no como
 * acusación. Que la portada lo diga —y no sólo la app— es lo que hace que la
 * primera vez que alguien vea los ojos cerrados sepa leerlos.
 *
 * ## Las tiendas van en «muy pronto», y ahí se quedan
 *
 * Es el estado `próximamente` del diseño. No se adelanta: una tienda anunciada
 * y vacía es la primera promesa incumplida que alguien se lleva de la portada.
 */

/** Lo que dice Ontoy si lo despiertan, en orden. Vuelve a dormirse solo. */
const REFUNFUÑOS = ["¡cinco minutitos más!", "mmm…", "ya voy, ya voy"];

export function Instalar() {
  const [despierto, setDespierto] = useState(-1);

  return (
    <section id="instalar" className="landing-instalar">
      <div className="landing-caja landing-instalar-caja">
        <div className="landing-instalar-dicho">
          <h2>Muy pronto en tu teléfono.</h2>
          <p className="landing-lead landing-lead-claro">
            Estamos preparando las apps para iPhone y Android. Mientras,{" "}
            <strong>Ontoy ya funciona en tu navegador</strong>: sin cuenta y sin descargar nada.
          </p>

          <div className="landing-acciones">
            <Link href="/rutas" className="landing-boton landing-boton-claro">
              Abrir Ontoy
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="landing-tiendas-cajas">
            {["App Store", "Google Play"].map((t) => (
              <span key={t} className="landing-tienda">
                <small>Muy pronto en</small>
                <b>{t}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="landing-dormido">
          <button
            type="button"
            className="landing-despertar"
            onClick={() => setDespierto((d) => (d + 1) % REFUNFUÑOS.length)}
            aria-label="Despierta a Ontoy"
          >
            {/* Las zetas del sueño, que se van cuando lo despiertan. */}
            <span className="landing-zetas" aria-hidden="true" data-durmiendo={despierto < 0}>
              <i>z</i>
              <i>z</i>
              <i>Z</i>
            </span>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <ellipse cx="44" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
              <ellipse cx="76" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
              <path
                d="M34 30 C40 18 60 16 74 19 C90 22 98 34 97 52 C96 68 94 80 86 88 C78 94 66 95 58 94 C46 95 34 92 28 82 C22 70 22 52 26 42 C28 36 30 33 34 30 Z"
                fill="var(--ontoy)"
              />
              {/*
               * **Los ojos cerrados son la sección.** Son dos arcos, la forma
               * que el universo usa para «descansando» — y que aquí significa
               * «no hay dato».
               */}
              <path
                d="M40 53 q10 6 20 0 M66 51 q10 6 20 0"
                fill="none"
                stroke="var(--pupila)"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              {/* Dormido no tiene boca: la boca sólo sale en las reacciones. */}
              <circle cx="12" cy="58" r="6" fill="var(--ontoy)" />
              <circle cx="110" cy="54" r="6" fill="var(--ontoy)" />
            </svg>
            <span className="landing-refunfuño">
              {despierto >= 0 ? REFUNFUÑOS[despierto] : "shhh…"}
            </span>
          </button>

          <p className="landing-nota-dormido">
            Cuando no hay corridas, Ontoy descansa.{" "}
            <strong>Ojos cerrados = no hay dato, no que no venga.</strong> (Si lo tocas, se
            despierta tantito.)
          </p>
        </div>
      </div>
    </section>
  );
}
