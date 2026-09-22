"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvisoDeError, Encabezado, Renglon, Vacio } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";

/**
 * Las unidades de un circuito, en el expediente de J-Staff (PR A2 de la ficha
 * de Circuitos, 21-sep-2026).
 *
 * - **«Asignada», nunca «corriendo»**: esto es lo que se espera; si de verdad
 *   corre lo dice la torre, que es la que mide.
 * - **Quién asignó y quién soltó**, firmados por el servidor con la sesión
 *   (0048). Las de antes de firmar dicen «sin registro de quién».
 * - **Antes de jalar un camión de otro circuito se avisa** qué asignación se
 *   cierra; el servidor la cierra en la misma operación.
 * - La historia enseña las últimas 10 y deja ver todas (ASAV, 21-sep).
 *
 * Las escrituras son las de siempre (`/api/jstaff/circuitos/[id]/unidades`).
 */

export interface AsignacionEnPantalla {
  id: string;
  unidad: string;
  transportista: string;
  desde: string;
  hasta: string | null;
  asignadaPor: string | null;
  cerradaPor: string | null;
  motivo: string | null;
}

export interface AsignableEnPantalla {
  unitId: string;
  label: string;
  transportista: string;
  /** El circuito donde corre ahora, si corre en otro. */
  ocupadaEn: string | null;
  ocupadaEnEste: boolean;
}

const HISTORIA_VISIBLE = 10;

export function UnidadesDelCircuito({
  circuitId,
  vigentes,
  historia,
  asignables,
}: {
  circuitId: string;
  vigentes: AsignacionEnPantalla[];
  historia: AsignacionEnPantalla[];
  asignables: AsignableEnPantalla[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [elegida, setElegida] = useState("");
  const [soltando, setSoltando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [todas, setTodas] = useState(false);

  const candidata = asignables.find((a) => a.unitId === elegida) ?? null;
  const libres = asignables.filter((a) => !a.ocupadaEnEste);

  async function asignar() {
    if (!candidata) return;
    setOcupado(true);
    setError(null);
    const r = await fetch(`/api/jstaff/circuitos/${circuitId}/unidades`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ unidadId: candidata.unitId }),
    });
    setOcupado(false);
    if (!r.ok) {
      setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "No se pudo asignar.");
      return;
    }
    setElegida("");
    router.refresh();
  }

  async function soltar(asignacionId: string) {
    setOcupado(true);
    setError(null);
    const q = motivo.trim() ? `?motivo=${encodeURIComponent(motivo.trim())}` : "";
    const r = await fetch(`/api/jstaff/circuitos/${circuitId}/unidades/${asignacionId}${q}`, { method: "DELETE" });
    setOcupado(false);
    if (!r.ok) {
      setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "No se pudo soltar.");
      return;
    }
    setSoltando(null);
    setMotivo("");
    router.refresh();
  }

  const visibles = todas ? historia : historia.slice(0, HISTORIA_VISIBLE);

  return (
    <div className="flex flex-col gap-2.5">
      {error && <AvisoDeError mensaje={error} />}

      {vigentes.length === 0 ? (
        <Vacio>Sin unidades asignadas</Vacio>
      ) : (
        vigentes.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[17px]" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700 }}>
                {a.unidad}
              </span>
              <span className="text-[13px] text-[var(--tenue)]">
                {a.transportista} · asignada el <span data-medida>{a.desde}</span> ·{" "}
                {a.asignadaPor ? `por ${a.asignadaPor}` : "sin registro de quién"}
              </span>
              <button
                type="button"
                className={`${clases.secundario} ml-auto px-3 py-1.5 text-[13px]`}
                onClick={() => {
                  setSoltando(soltando === a.id ? null : a.id);
                  setMotivo("");
                }}
                aria-expanded={soltando === a.id}
              >
                Soltar
              </button>
            </div>
            {soltando === a.id && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${clases.campo} min-w-[220px] flex-1`}
                  placeholder="Por qué se suelta (queda escrito)"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  aria-label={`Motivo para soltar ${a.unidad}`}
                />
                <button type="button" className={clases.primario} disabled={ocupado || !motivo.trim()} onClick={() => soltar(a.id)}>
                  Soltar {a.unidad}
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <div className={clases.panel}>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Asignar una unidad
          <select className={clases.campo} value={elegida} onChange={(e) => setElegida(e.target.value)}>
            <option value="">Escoge la unidad</option>
            {libres.map((u) => (
              <option key={u.unitId} value={u.unitId}>
                {u.label} · {u.transportista}
                {u.ocupadaEn ? ` · corre en ${u.ocupadaEn}` : ""}
              </option>
            ))}
          </select>
        </label>
        {candidata?.ocupadaEn && (
          /* El aviso ANTES de confirmar: en tinta y con su frase, sin cobre (un aviso no es vida). */
          <p role="status" className={clases.aviso}>
            <span className="font-semibold">{candidata.label} está asignada a {candidata.ocupadaEn}.</span> Al asignarla
            aquí se cierra esa asignación, en la misma operación.
          </p>
        )}
        {libres.length === 0 && <p className={clases.ayuda}>No hay unidades de los transportistas ligados a esta concesión para asignar.</p>}
        <div>
          <button type="button" className={clases.primario} disabled={!candidata || ocupado} onClick={asignar}>
            {candidata?.ocupadaEn ? `Asignar y cerrar la de ${candidata.ocupadaEn}` : "Asignar"}
          </button>
        </div>
      </div>

      {historia.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <Encabezado izquierda="Ya soltadas" derecha={`${historia.length}`} />
          {visibles.map((a) => (
            <Renglon key={a.id} pregunta={`${a.unidad} · ${a.transportista}`} tenue>
              {a.desde} → {a.hasta} · {a.cerradaPor ? `soltó ${a.cerradaPor}` : "sin registro de quién"}
              {a.motivo ? ` · «${a.motivo}»` : ""}
            </Renglon>
          ))}
          {historia.length > HISTORIA_VISIBLE && (
            <button type="button" className={`${clases.secundario} self-start`} onClick={() => setTodas(!todas)}>
              {todas ? "Ver sólo las últimas 10" : `Ver todas (${historia.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
