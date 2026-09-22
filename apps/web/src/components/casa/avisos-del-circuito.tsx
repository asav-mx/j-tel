"use client";

import { useMemo, useState } from "react";
import { DETALLE_MAXIMO, TITULO_MAXIMO, instanteDeCampoLocal, validarAviso } from "@jtel/domain";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";

/**
 * **Avisos al pasajero** — lo que la concesión le dice al pasajero de esta
 * ruta, capturado aquí por J-Staff (Marco 8.13b; Ontoy 2.0, PR 4a; 0052).
 *
 * - En Ontoy se lee **«según la concesión»** con su fecha. Aquí queda además
 *   **quién lo capturó**, que el pasajero no ve.
 * - **No se edita: se retira con motivo**, firmado. Un aviso dicho queda en la
 *   historia; si cambió, se retira y se captura otro.
 * - **La vista previa** usa la MISMA validación que el servidor
 *   (`validarAviso`): lo que dice aquí es lo que va a contestar allá.
 * - Nunca un letrero de alarma: sin rojo, sin íconos; un título todo en
 *   mayúsculas se rechaza con la razón.
 */

export interface AvisoEnPantalla {
  id: string;
  titulo: string;
  detalle: string | null;
  situacion: "en_ontoy" | "programado" | "termino" | "retirado";
  vigencia: string;
  capturado: string;
  retiro: string | null;
}

const SITUACION: Record<AvisoEnPantalla["situacion"], string> = {
  en_ontoy: "EN ONTOY AHORA",
  programado: "PROGRAMADO",
  termino: "TERMINÓ",
  retirado: "RETIRADO",
};

export function AvisosDelCircuito({
  circuitId,
  zona,
  avisos,
}: {
  circuitId: string;
  zona: string;
  avisos: AvisoEnPantalla[];
}) {
  const volver = `/casa/jstaff/circuitos/${circuitId}`;
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const previa = useMemo(
    () =>
      validarAviso(
        { titulo, detalle, desde: instanteDeCampoLocal(desde, zona), hasta: instanteDeCampoLocal(hasta, zona) },
        new Date(),
      ),
    [titulo, detalle, desde, hasta, zona],
  );
  const cuando = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", { timeZone: zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

  return (
    <div className="flex flex-col gap-3">
      <form action={`/api/jstaff/circuitos/${circuitId}/avisos`} method="post" className={clases.panel}>
        <input type="hidden" name="volver" value={volver} />
        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold">Título</span>
            <span data-medida className="ml-auto text-[11px] text-[var(--tenue)]">
              {titulo.trim().length}/{TITULO_MAXIMO}
            </span>
          </span>
          <input
            name="titulo"
            required
            maxLength={TITULO_MAXIMO}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="La ruta va por Av. de la Raza"
            className={clases.campo}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold">Detalle</span>
            <span className="text-[11px] text-[var(--tenue)]">opcional</span>
            <span data-medida className="ml-auto text-[11px] text-[var(--tenue)]">
              {detalle.trim().length}/{DETALLE_MAXIMO}
            </span>
          </span>
          <textarea
            name="detalle"
            maxLength={DETALLE_MAXIMO}
            rows={3}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Mientras dure la obra en Tecnológico. La parada Tecnológico no se da; la más cercana es Mercado Cuauhtémoc."
            className={clases.campo}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Desde</span>
            <input type="datetime-local" name="desde" value={desde} onChange={(e) => setDesde(e.target.value)} className={clases.campo} />
            <span className={clases.ayuda}>Vacío: desde que lo capturas.</span>
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Hasta</span>
            <input type="datetime-local" name="hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} className={clases.campo} />
            <span className={clases.ayuda}>Vacío: hasta que lo retires. Hora de {zona.split("/").pop()?.replace(/_/g, " ")}.</span>
          </label>
        </div>

        {/* La vista previa: lo que el pasajero va a leer, con la misma validación que el servidor. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Así lo ve el pasajero</span>
          {titulo.trim() === "" ? (
            <p className={clases.nota}>Escribe el título para verlo.</p>
          ) : previa.ok ? (
            <div className="rounded-[12px] border border-[var(--linea)] bg-[var(--papel)] px-3.5 py-3">
              <span data-medida className="block text-[10px] uppercase tracking-[0.08em] text-[var(--tenue)]">
                {cuando(previa.aviso.vigenteDesde)} · según la concesión
              </span>
              <span className="mt-1.5 block text-[15px]" style={estiloTitularDePanel}>
                {previa.aviso.titulo}
              </span>
              {previa.aviso.detalle && (
                <span className="mt-1 block text-[13px] text-[var(--tenue)]">{previa.aviso.detalle}</span>
              )}
            </div>
          ) : (
            <p role="status" className={clases.aviso}>
              {previa.error}
            </p>
          )}
        </div>

        <div>
          <button type="submit" className={clases.primario} disabled={!previa.ok}>
            Capturar el aviso
          </button>
        </div>
      </form>

      {avisos.length === 0 ? (
        <p className={clases.nota}>Este circuito no ha dado ningún aviso.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {avisos.map((a) => {
            const vivo = a.situacion === "en_ontoy" || a.situacion === "programado";
            return (
              <li
                key={a.id}
                className={`flex flex-col gap-1.5 rounded-lg border px-4 py-3 ${
                  vivo ? "border-[var(--tinta)] bg-[var(--pieza)]" : "border-[var(--linea)]"
                }`}
              >
                <span className="flex flex-wrap items-baseline gap-x-2.5">
                  <span
                    data-medida
                    className={`text-[10.5px] tracking-[0.12em] ${a.situacion === "en_ontoy" ? "font-semibold" : "text-[var(--tenue)]"}`}
                  >
                    {SITUACION[a.situacion]}
                  </span>
                  <span data-medida className="text-[11.5px] text-[var(--tenue)]">
                    {a.vigencia}
                  </span>
                </span>
                <span className={`text-[15px] ${vivo ? "" : "text-[var(--tenue)]"}`} style={estiloTitularDePanel}>
                  {a.titulo}
                </span>
                {a.detalle && <span className="text-[13px] text-[var(--tenue)]">{a.detalle}</span>}
                <span className={clases.ayuda}>{a.capturado}</span>
                {a.retiro && <span className={clases.ayuda}>{a.retiro}</span>}
                {vivo && (
                  <form
                    action={`/api/jstaff/circuitos/${circuitId}/avisos/${a.id}/retirar`}
                    method="post"
                    className="mt-1 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="volver" value={volver} />
                    <input
                      name="motivo"
                      required
                      maxLength={280}
                      aria-label={`Por qué se retira «${a.titulo}»`}
                      placeholder="Por qué se retira (queda escrito)"
                      className={`${clases.campo.replace("w-full ", "")} min-w-[220px] flex-1`}
                    />
                    <button type="submit" className={clases.secundario}>
                      Retirar
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
