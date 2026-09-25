"use client";

import Link from "next/link";
import { OntoyQueReacciona } from "../ontoy-que-reacciona";

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

export function Instalar() {

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
          {/*
           * Ontoy dormido, y **dormido de verdad**: las zetas se mueven y, si
           * lo tocas, abre un ojo, refunfuña y se vuelve a dormir. Antes sólo
           * cambiaba el texto de abajo — el dibujo se quedaba igual, que es
           * como decir que reacciona sin que reaccione.
           */}
          <OntoyQueReacciona reaccion="dormido" etiqueta="shhh…" className="landing-ontoy-dormido" />

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
