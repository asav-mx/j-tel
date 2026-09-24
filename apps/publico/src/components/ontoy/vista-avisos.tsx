"use client";

import { fechaDelAviso, type AvisoEnLaCampana } from "@/lib/ontoy/avisos";
import type { AvisoDelTelefono } from "@/lib/ontoy/avisos-del-telefono";

/**
 * **Avisos de tus rutas** — lo que abre la campana (8.13b; Ontoy 2.0, PR 4b).
 *
 * - **De la concesión:** fechado y atribuido — «Ayer 14:20 · según la
 *   concesión» —, con la franja del color de su ruta y su nombre (8.8c: el color
 *   nunca va solo). En la tinta de siempre: **nunca un letrero de alarma**.
 * - **Del teléfono, aparte** y con su etiqueta: lo que le pasó a este aparato.
 *   No dice nada del servicio, y lo dice.
 *
 * Toda pantalla tiene su salida (8.10): «‹ Volver» arriba y la barra abajo.
 */
export function VistaAvisos({
  avisos,
  telefono,
  alVolver,
  alAbrirRuta,
}: {
  avisos: AvisoEnLaCampana[];
  telefono: AvisoDelTelefono[];
  alVolver: () => void;
  alAbrirRuta: (ruta: string) => void;
}) {
  const ahora = new Date();
  const hora = (iso: string) =>
    new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const minutos = (a: AvisoDelTelefono) =>
    Math.max(1, Math.round(((a.hasta ? new Date(a.hasta) : ahora).getTime() - new Date(a.desde).getTime()) / 60_000));

  return (
    <div className="ontoy-vista">
      <button type="button" className="ontoy-volver" onClick={alVolver}>
        ‹ Volver
      </button>
      <section className="ontoy-seccion">
        <h2 className="ontoy-seccion-titulo">Avisos de tus rutas</h2>
        {avisos.length === 0 ? (
          <p className="ontoy-vacio">Tus rutas no tienen avisos de la concesión.</p>
        ) : (
          avisos.map((a) => (
            <button
              key={a.id}
              type="button"
              className="ontoy-aviso"
              style={{ ["--ruta" as string]: a.color }}
              onClick={() => alAbrirRuta(a.ruta)}
            >
              <span className="ontoy-aviso-cuando cifra">
                {fechaDelAviso(a.desde, a.zona, ahora)} · según la concesión
              </span>
              <span className="ontoy-aviso-ruta">
                Ruta <b>{a.nombreDeRuta}</b>
              </span>
              <span className="ontoy-aviso-titulo">{a.titulo}</span>
              {a.detalle && <span className="ontoy-aviso-detalle">{a.detalle}</span>}
              {a.hasta && <span className="ontoy-aviso-hasta cifra">hasta el {fechaDelAviso(a.hasta, a.zona, ahora).replace(/^(Hoy|Ayer) /, (m) => m.toLowerCase())}</span>}
            </button>
          ))
        )}
        <p className="ontoy-vacio">Cada aviso dice quién lo dijo y desde cuándo.</p>
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
