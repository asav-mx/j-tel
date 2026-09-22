"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FranjaCapturada, SentidoDeFranja, TipoDeDiaCircuito } from "@jtel/domain";
import { AvisoDeError } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";

/**
 * La promesa por franja, en el expediente de J-Staff (PR A2 de la ficha de
 * Circuitos, 21-sep-2026). Cada cuántos minutos pasa el camión, por horario,
 * tipo de día y sentido: la vara de la torre y lo que Ontoy publica — una sola
 * fuente (9.1c).
 *
 * - Una pestaña por tipo de día; **la que no tiene franjas dice «falta»**.
 * - **Se guarda todo o nada**, con la ruta de siempre: si una franja cae fuera
 *   del horario o se encima con otra, no se guarda nada y su renglón dice por
 *   qué.
 * - Reemplazar la vigente pide motivo: es lo único de la versión que se cierra
 *   que nadie puede reconstruir después. Quién la capturó lo pone el servidor.
 */

const DIAS: Array<{ tipo: TipoDeDiaCircuito; nombre: string }> = [
  { tipo: "entre_semana", nombre: "Entre semana" },
  { tipo: "sabado", nombre: "Sábado" },
  { tipo: "domingo", nombre: "Domingo" },
];

const SENTIDOS: Array<{ valor: SentidoDeFranja; nombre: string }> = [
  { valor: null, nombre: "Los dos sentidos" },
  { valor: "ida", nombre: "Sólo ida" },
  { valor: "vuelta", nombre: "Sólo vuelta" },
];

interface Fila {
  clave: number;
  diaTipo: TipoDeDiaCircuito;
  sentido: SentidoDeFranja;
  desde: string;
  hasta: string;
  cada: string;
}

/** El campo de la casa sin su ancho completo: en un renglón de franja van cinco lado a lado. */
const corto = clases.campo.replace("w-full ", "");

let siguiente = 1;
const fila = (f: Omit<Fila, "clave">): Fila => ({ ...f, clave: siguiente++ });

export function PromesaDelCircuito({
  circuitId,
  vigentes,
  hayVigente,
  horario,
}: {
  circuitId: string;
  /** Las franjas de la promesa vigente; vacío si no hay o no tiene. */
  vigentes: FranjaCapturada[];
  hayVigente: boolean;
  horario: { abre: string; cierra: string };
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>(() =>
    vigentes.map((f) =>
      fila({
        diaTipo: f.diaTipo,
        sentido: f.sentido,
        desde: f.desdeLocal.slice(0, 5),
        hasta: f.hastaLocal.slice(0, 5),
        cada: String(f.frequencyMinutes),
      }),
    ),
  );
  const [dia, setDia] = useState<TipoDeDiaCircuito>("entre_semana");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rechazos, setRechazos] = useState<Map<number, string>>(new Map());
  const [ocupado, setOcupado] = useState(false);

  const delDia = filas.filter((f) => f.diaTipo === dia);
  const cambiar = (clave: number, cambio: Partial<Fila>) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));

  function copiarALosOtros() {
    const otros = DIAS.filter((d) => d.tipo !== dia).map((d) => d.tipo);
    setFilas((fs) => [
      ...fs.filter((f) => f.diaTipo === dia),
      ...otros.flatMap((o) => fs.filter((f) => f.diaTipo === dia).map((f) => fila({ ...f, diaTipo: o }))),
    ]);
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    setRechazos(new Map());
    const orden = [...filas];
    const r = await fetch(`/api/jstaff/circuitos/${circuitId}/promesa`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        motivo,
        franjas: orden.map((f) => ({
          diaTipo: f.diaTipo,
          sentido: f.sentido,
          desdeLocal: f.desde,
          hastaLocal: f.hasta,
          frequencyMinutes: Number(f.cada),
        })),
      }),
    });
    setOcupado(false);
    const cuerpo = (await r.json().catch(() => null)) as {
      error?: string;
      rechazadas?: Array<{ indice: number; razon: string }>;
    } | null;
    if (!r.ok) {
      setError(cuerpo?.error ?? "No se guardó.");
      if (cuerpo?.rechazadas) {
        setRechazos(new Map(cuerpo.rechazadas.filter((x) => orden[x.indice]).map((x) => [orden[x.indice]!.clave, x.razon])));
        // Lleva a la pestaña del primer renglón rechazado: si no, el error se ve y el renglón no.
        const primero = cuerpo.rechazadas.map((x) => orden[x.indice]).find(Boolean);
        if (primero) setDia(primero.diaTipo);
      }
      return;
    }
    setMotivo("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Tipo de día" className="flex flex-wrap gap-1.5">
        {DIAS.map((d) => {
          const n = filas.filter((f) => f.diaTipo === d.tipo).length;
          const activo = d.tipo === dia;
          return (
            <button
              key={d.tipo}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setDia(d.tipo)}
              className={`cursor-pointer rounded-lg border px-3.5 py-2 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)] ${
                activo ? "border-[var(--tinta)] bg-[var(--tinta)] text-[var(--papel)]" : "border-[var(--linea)] bg-[var(--pieza)] text-[var(--tinta)]"
              }`}
            >
              {d.nombre}
              {n === 0 ? <span className="font-semibold"> · falta</span> : <span data-medida> · {n}</span>}
            </button>
          );
        })}
      </div>

      {delDia.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--linea)] px-4 py-3 text-[13px]">
          <span className="font-semibold">Este día no tiene franjas.</span>{" "}
          <span className="text-[var(--tenue)]">
            La torre no puede medirlo y Ontoy dirá «Sin frecuencia publicada para esta hora».
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {delDia.map((f) => {
            const rechazo = rechazos.get(f.clave);
            return (
              <div
                key={f.clave}
                className={`flex flex-col gap-2 rounded-lg border bg-[var(--pieza)] px-3 py-2.5 ${rechazo ? "border-[var(--tinta)]" : "border-[var(--linea)]"}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <input type="time" aria-label="Desde" className={corto} value={f.desde} onChange={(e) => cambiar(f.clave, { desde: e.target.value })} />
                  <span className="text-[var(--tenue)]">a</span>
                  <input type="time" aria-label="Hasta" className={corto} value={f.hasta} onChange={(e) => cambiar(f.clave, { hasta: e.target.value })} />
                  <span className="text-[var(--tenue)]">cada</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    aria-label="Cada cuántos minutos"
                    className={`${corto} w-[84px]`}
                    value={f.cada}
                    onChange={(e) => cambiar(f.clave, { cada: e.target.value })}
                  />
                  <span className="text-[var(--tenue)]">min</span>
                  <select
                    aria-label="Sentido"
                    className={corto}
                    value={f.sentido ?? ""}
                    onChange={(e) => cambiar(f.clave, { sentido: (e.target.value || null) as SentidoDeFranja })}
                  >
                    {SENTIDOS.map((s) => (
                      <option key={s.nombre} value={s.valor ?? ""}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={`${clases.secundario} ml-auto px-3 py-1.5 text-[13px]`} onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}>
                    Quitar
                  </button>
                </div>
                {rechazo && (
                  <p role="alert" className="text-[13px] font-semibold">
                    {rechazo}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={clases.secundario}
          onClick={() => setFilas((fs) => [...fs, fila({ diaTipo: dia, sentido: null, desde: "", hasta: "", cada: "" })])}
        >
          Agregar franja
        </button>
        {delDia.length > 0 && (
          <button type="button" className={clases.secundario} onClick={copiarALosOtros}>
            Copiar este día a los otros dos
          </button>
        )}
      </div>
      <p className={clases.ayuda}>
        Horario de servicio <span data-medida>{horario.abre}–{horario.cierra}</span>: una franja fuera de él no se guarda.
        Copiar reemplaza las franjas de los otros dos días.
      </p>

      <div className={clases.panel}>
        {error && <AvisoDeError mensaje={error} />}
        {hayVigente && (
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Por qué cambia
            <input
              className={clases.campo}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Queda escrito en la versión que se cierra"
            />
          </label>
        )}
        <div>
          <button type="button" className={clases.primario} disabled={ocupado || (hayVigente && !motivo.trim())} onClick={guardar}>
            Guardar la promesa
          </button>
        </div>
      </div>
    </div>
  );
}
