"use client";

import { useState } from "react";
import { franjaDentroDelHorario, porQueNoSirveParaUnaRuta, type FranjaCapturada } from "@jtel/domain";
import { Renglon } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { SelectorDeColorDeRuta } from "@/components/casa/selector-de-color-de-ruta";

/**
 * La identidad de un circuito, editable desde el expediente de J-Staff (PR A4
 * de la ficha de Circuitos, 21-sep-2026): nombre, color, horario, zona y fecha
 * de arranque.
 *
 * **La escritura es la de siempre** (`POST /api/jstaff/circuitos/[id]`), con su
 * validación y sus mensajes; esta pantalla sólo le manda `volver`.
 *
 * **El identificador público no se edita**: va impreso en el QR de cada parada.
 *
 * **Antes de guardar se avisa si el horario nuevo deja franjas de la promesa
 * fuera.** El servidor sólo revisa las franjas contra el horario al guardar la
 * promesa; acortar el horario después las deja colgando sin que nadie lo diga.
 * El aviso usa la misma regla del dominio (`franjaDentroDelHorario`) y no
 * bloquea: decide quien opera.
 */
/** El día de cada franja, para que el aviso no repita la misma hora tres veces sin decir de cuándo es. */
const DIA: Record<FranjaCapturada["diaTipo"], string> = { entre_semana: "entre semana", sabado: "sábado", domingo: "domingo" };

export function IdentidadDelCircuito({
  circuitId,
  nombre,
  slug,
  concesion,
  color,
  abre,
  cierra,
  zona,
  arrancaEl,
  franjas,
  otrosCircuitos,
}: {
  circuitId: string;
  nombre: string;
  slug: string;
  concesion: string;
  color: string;
  abre: string;
  cierra: string;
  zona: string;
  arrancaEl: string | null;
  franjas: FranjaCapturada[];
  /** Los otros circuitos y su color, para avisar si se repite. */
  otrosCircuitos: { name: string; colorHex: string }[];
}) {
  const [inicio, setInicio] = useState(abre);
  const [fin, setFin] = useState(cierra);
  const [tono, setTono] = useState(color.toUpperCase());
  const [zonaNueva, setZonaNueva] = useState(zona);
  const [arranque, setArranque] = useState(arrancaEl ?? "");
  /*
   * El horario, la zona y la fecha de arranque son reglas de la medición (ASAV,
   * 21-sep): mueven la apertura y el cierre del día. Si cambian, se pide motivo
   * aquí —el servidor lo exige igual y lee el antes de la base—. Nombre y color
   * no son reglas: se guardan sin motivo.
   */
  const colorBloqueado = porQueNoSirveParaUnaRuta(tono) !== null;
  const cambiaUnaRegla = inicio !== abre || fin !== cierra || zonaNueva !== zona || arranque !== (arrancaEl ?? "");

  const fuera = franjas.filter((f) => !franjaDentroDelHorario(f, inicio, fin));
  const etiqueta = "flex flex-col gap-1.5 text-[13px] font-semibold";

  return (
    <form action={`/api/jstaff/circuitos/${circuitId}`} method="post" className="flex flex-col gap-3">
      <input type="hidden" name="volver" value={`/casa/jstaff/circuitos/${circuitId}`} />
      <input type="hidden" name="seccion" value="identidad" />

      <Renglon pregunta="Identificador público" medida>
        {slug} · no se edita: va impreso en el QR
      </Renglon>
      <Renglon pregunta="Concesión dueña">{concesion}</Renglon>

      <div className={clases.panel}>
        <label className={etiqueta}>
          Nombre
          <input name="nombre" defaultValue={nombre} required className={clases.campo} />
        </label>

        <SelectorDeColorDeRuta tono={tono} setTono={setTono} otrosCircuitos={otrosCircuitos} />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[13px] font-semibold">Horario de servicio</legend>
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-[var(--tenue)]">
            <label className="flex items-center gap-2">
              abre
              <input type="time" name="horaInicio" value={inicio} onChange={(e) => setInicio(e.target.value)} required className={clases.campo.replace("w-full ", "")} />
            </label>
            <label className="flex items-center gap-2">
              cierra
              <input type="time" name="horaFin" value={fin} onChange={(e) => setFin(e.target.value)} required className={clases.campo.replace("w-full ", "")} />
            </label>
          </div>
          {fuera.length > 0 && (
            /* En tinta y con su frase: sin cobre (un aviso no es vida). No bloquea. */
            <p role="status" className={clases.aviso}>
              <span className="font-semibold">
                Con este horario, {fuera.length === 1 ? "1 franja de la promesa queda" : `${fuera.length} franjas de la promesa quedan`} fuera:
              </span>{" "}
              {fuera.map((f) => `${DIA[f.diaTipo]} ${f.desdeLocal.slice(0, 5)}–${f.hastaLocal.slice(0, 5)}`).join(" · ")}. La torre no las mide
              y Ontoy no las dice; se corrigen en la promesa.
            </p>
          )}
        </fieldset>

        <label className={etiqueta}>
          Zona horaria
          <input name="zonaHoraria" value={zonaNueva} onChange={(e) => setZonaNueva(e.target.value)} required className={clases.campo} />
        </label>

        <label className={etiqueta}>
          Arranca el
          <input
            type="date"
            name="arrancaEl"
            value={arranque}
            onChange={(e) => setArranque(e.target.value)}
            className={`${clases.campo.replace("w-full ", "")} w-auto`}
          />
          <span className={clases.ayuda}>Vacío: el circuito ya opera. Nunca se rellena con hoy.</span>
        </label>

        {cambiaUnaRegla && (
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Por qué cambia el horario, la zona o el arranque
            <input
              name="motivo"
              required
              maxLength={280}
              className={clases.campo}
              placeholder="Mueve la apertura y el cierre del día: queda escrito con tu nombre"
            />
          </label>
        )}
        <div>
          {/* Apagado mientras el color no se pueda guardar: el servidor lo
              rechazaría igual, y dejar apretar el botón para que lo diga él
              convierte una regla en un viaje de ida y vuelta. */}
          <button type="submit" disabled={colorBloqueado} className={clases.primario}>
            Guardar la identidad
          </button>
        </div>
      </div>
    </form>
  );
}
