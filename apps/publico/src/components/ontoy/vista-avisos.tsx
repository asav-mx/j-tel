"use client";

import { useState } from "react";
import { etiquetaCortaDeLaRuta } from "@jtel/domain";
import { deQuienSonLosAvisos, fechaDelAviso, type AvisoEnLaCampana } from "@/lib/ontoy/avisos";
import type { AvisoDelTelefono } from "@/lib/ontoy/avisos-del-telefono";
import { Ontoy } from "@/components/ontoy/ontoy-muneco";

/**
 * Lo que dice la placa: el número si la ruta lo trae («51»), o su nombre entero.
 *
 * `etiquetaCortaDeLaRuta` baja a iniciales cuando no hay número —«OC» por
 * Oasis-Centro—, y eso sirve en una lámina con el nombre impreso al lado. Aquí
 * la placa va sola junto al título: unas iniciales no nombran ninguna ruta, y
 * el color no puede ir solo (8.8c).
 */
export function nombreEnLaPlaca(nombre: string): string {
  const corta = etiquetaCortaDeLaRuta(nombre);
  return /\d/.test(corta) || corta === nombre.trim() ? corta : nombre.trim();
}

/**
 * **Avisos** — lo que abre la tarjeta de avisos de Inicio (8.13b; 3-ir-a/14 y /15).
 *
 * - **De la concesión:** fechado y atribuido —«Hoy 9:10 · según la
 *   concesión»—, con la placa de su ruta (8.8c: el color nunca va solo) y un
 *   punto si todavía no lo habías visto. En la tinta de siempre: **nunca un
 *   letrero de alarma**.
 * - **Del teléfono, aparte** y con su etiqueta: lo que le pasó a este aparato.
 *   No dice nada del servicio, y lo dice.
 *
 * **Es una página de Inicio**, como en el diseño: «← Inicio» arriba, y la barra
 * marca Inicio aunque se haya abierto desde las paradas de una ruta
 * (`abrirCampana` en `ontoy.tsx`). Antes marcaba Mapa estando en Avisos.
 *
 * **Sin avisos ni nada del teléfono, pantalla completa** (3-ir-a/15): no hay nada
 * más que enseñar, y una línea suelta arriba de una pantalla vacía se lee como
 * si faltara algo por cargar.
 */
export function VistaAvisos({
  avisos,
  telefono,
  vistos,
  rutasGuardadas,
  alVolver,
  alAbrirRuta,
}: {
  avisos: AvisoEnLaCampana[];
  telefono: AvisoDelTelefono[];
  /** Los que ya habías visto. Abrir esta pantalla los marca todos; el punto se queda hasta salir. */
  vistos: ReadonlySet<string>;
  /** Las rutas de tus paradas guardadas: decide si la línea de arriba puede decir «guardadas». */
  rutasGuardadas: ReadonlySet<string>;
  alVolver: () => void;
  alAbrirRuta: (ruta: string) => void;
}) {
  /*
   * Los vistos **de cuando se abrió**. Al abrir, `ontoy.tsx` marca todo como
   * visto; si la pantalla leyera los vistos al día, los puntos se apagarían en
   * el mismo instante de aparecer y nunca dirían cuál es nuevo.
   */
  const [vistosAlAbrir] = useState(vistos);
  const ahora = new Date();
  const hora = (iso: string) =>
    new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const minutos = (a: AvisoDelTelefono) =>
    Math.max(1, Math.round(((a.hasta ? new Date(a.hasta) : ahora).getTime() - new Date(a.desde).getTime()) / 60_000));

  const cabeza = (
    <header className="ontoy-avisos-cabeza">
      <button type="button" className="ontoy-avisos-volver" onClick={alVolver}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M19.5 12H5M11 5.5 4.5 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Inicio
      </button>
      <h1 className="ontoy-inicio-titulo">Avisos</h1>
      <p className="ontoy-inicio-contexto">{deQuienSonLosAvisos(avisos, rutasGuardadas)}</p>
    </header>
  );

  if (avisos.length === 0 && telefono.length === 0) {
    return (
      <div className="ontoy-vista ontoy-vista-llena">
        {cabeza}
        <section className="ontoy-completa ontoy-completa-dentro">
          <Ontoy pose="al-frente" tamano={128} />
          <h2 className="ontoy-completa-titular">Sin avisos de tus rutas.</h2>
          <p className="ontoy-completa-ayuda">
            Si la concesión avisa un desvío o un cambio de horario, aquí lo ves con su fecha.
          </p>
          <button type="button" className="ontoy-boton ontoy-boton-principal ontoy-boton-contorno" onClick={alVolver}>
            Volver al inicio
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="ontoy-vista">
      {cabeza}
      <section className="ontoy-seccion">
        {avisos.length === 0 ? (
          <p className="ontoy-vacio">Sin avisos de tus rutas.</p>
        ) : (
          avisos.map((a) => (
            <button
              key={a.id}
              type="button"
              className="ontoy-aviso"
              onClick={() => alAbrirRuta(a.ruta)}
            >
              <span className="ontoy-aviso-cuando">
                {fechaDelAviso(a.desde, a.zona, ahora)} · según la concesión
                {!vistosAlAbrir.has(a.id) && <span className="ontoy-aviso-nuevo" aria-label="nuevo" />}
              </span>
              <span className="ontoy-aviso-titulo">
                {/* La placa lleva la franja de su ruta y su nombre corto: el color nunca va solo (8.8c). */}
                <span className="ontoy-placa" style={{ ["--ruta" as string]: a.color }}>
                  {nombreEnLaPlaca(a.nombreDeRuta)}
                </span>
                <span>{a.titulo}</span>
              </span>
              {a.detalle && <span className="ontoy-aviso-detalle">{a.detalle}</span>}
              {a.hasta && <span className="ontoy-aviso-hasta cifra">hasta el {fechaDelAviso(a.hasta, a.zona, ahora).replace(/^(Hoy|Ayer) /, (m) => m.toLowerCase())}</span>}
            </button>
          ))
        )}
      </section>

      {telefono.length > 0 && (
        <section className="ontoy-seccion">
          <h2 className="ontoy-seccion-titulo">Tu teléfono</h2>
          {[...telefono].reverse().map((a, i) => (
            <div key={`${a.tipo}-${a.desde}-${i}`} className="ontoy-aviso ontoy-aviso-telefono">
              <span className="ontoy-aviso-cuando cifra">
                {a.hasta ? `${hora(a.desde)}–${hora(a.hasta)}` : `desde las ${hora(a.desde)}`} · tu teléfono
              </span>
              <span className="ontoy-aviso-titulo">
                {a.tipo === "red"
                  ? a.hasta
                    ? `No pudimos preguntar durante ${minutos(a)} min`
                    : "No podemos preguntar ahorita"
                  : "El servidor nos pidió esperar"}
              </span>
              <span className="ontoy-aviso-detalle">
                {a.tipo === "red"
                  ? "Se cayó la conexión del teléfono. No dice nada del servicio: lo que ves es lo último que supimos, con su edad."
                  : "Preguntamos más despacio un rato. No dice nada del servicio."}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
