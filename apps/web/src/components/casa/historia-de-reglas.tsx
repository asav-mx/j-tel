"use client";

import { useState } from "react";
import { Encabezado } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";

/**
 * La historia de las reglas de la medición de un circuito (0051, A4b): cada
 * cambio con su antes → después —leído de la base al guardar, no de lo que dijo
 * el formulario—, quién, cuándo y por qué. Las últimas 10 y «ver todas»: en la
 * semana de calibración se van a mover seguido (ASAV, 21-sep).
 *
 * Sin cobre y sin forma: es recuerdo, y cada renglón se lee en palabras.
 */

export interface CambioDeRegla {
  id: string;
  regla: string;
  antes: string | null;
  despues: string | null;
  cuando: string;
  quien: string;
  motivo: string;
}

const VISIBLES = 10;

export function HistoriaDeReglas({ cambios }: { cambios: CambioDeRegla[] }) {
  const [todas, setTodas] = useState(false);
  if (cambios.length === 0) {
    return (
      <p className="text-[13px] text-[var(--tenue)]">
        Sin cambios registrados. El registro empezó con la 0051: lo que se movió antes no dejó autor, y no se inventa.
      </p>
    );
  }
  const visibles = todas ? cambios : cambios.slice(0, VISIBLES);
  return (
    <div className="flex flex-col gap-2">
      <Encabezado izquierda="Cambios de las reglas" derecha={`${cambios.length}`} />
      {visibles.map((c) => (
        <div key={c.id} className="flex flex-col gap-0.5 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-2.5">
          <span className="flex flex-wrap items-baseline gap-x-2.5 text-[13.5px]">
            <span className="font-semibold">{c.regla}</span>
            <span data-medida>
              {c.antes ?? "—"} → {c.despues ?? "—"}
            </span>
          </span>
          <span className="text-[12.5px] text-[var(--tenue)]">
            <span data-medida>{c.cuando}</span> · {c.quien} · «{c.motivo}»
          </span>
        </div>
      ))}
      {cambios.length > VISIBLES && (
        <button type="button" className={`${clases.secundario} self-start`} onClick={() => setTodas(!todas)}>
          {todas ? "Ver sólo los últimos 10" : `Ver todos (${cambios.length})`}
        </button>
      )}
    </div>
  );
}
