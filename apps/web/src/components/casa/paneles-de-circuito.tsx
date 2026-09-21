"use client";

import Link from "next/link";
import { useState } from "react";
import { MOTIVO_MAX } from "@jtel/domain";
import { Pieza } from "@/components/casa/pieza";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";

/**
 * Los paneles de acción de Ver ‹circuito›: el carrier asigna y suelta **sus**
 * unidades (ficha de huecos de «asignar unidad», PR 2).
 *
 * Formularios de verdad que postean a `/api/casa/circuitos`, con la misma forma
 * que los de Ver ‹dispositivo›. El cliente sólo filtra, marca y avisa; todo lo
 * que decide —si la unidad es suya, si la concesión lo liga, si el circuito que
 * se cierra es el que avisó— lo vuelve a decidir el servidor.
 */

type Comunes = {
  cuenta: string;
  circuitId: string;
  nombreDelCircuito: string;
  cancelar: string;
  error: string | null;
};

export type UnidadAsignable = {
  unitId: string;
  numeroEconomico: string;
  /** El circuito que corre hoy, si corre alguno. */
  corre: { circuitId: string; nombre: string | null } | null;
};

export function PanelAsignarUnidad({
  cuenta,
  circuitId,
  nombreDelCircuito,
  cancelar,
  error,
  unidades,
}: Comunes & { unidades: UnidadAsignable[] }) {
  const [buscar, setBuscar] = useState("");
  const [elegida, setElegida] = useState<string | null>(null);

  // Libres primero: es lo que se busca al armar la salida del día.
  const lista = unidades
    .filter((u) => u.numeroEconomico.includes(buscar))
    .sort((a, b) => Number(a.corre !== null) - Number(b.corre !== null));
  const unidad = unidades.find((u) => u.unitId === elegida) ?? null;

  return (
    <form action="/api/casa/circuitos" method="post" className={clases.panel} aria-label="Asignar una unidad">
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        Asignar una unidad a {nombreDelCircuito}
      </h3>
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value="asignar" />
      <input type="hidden" name="circuitId" value={circuitId} />
      <input type="hidden" name="unitId" value={elegida ?? ""} />
      {/*
       * El circuito que el aviso de abajo nombró. El servidor sólo cierra ése:
       * si la unidad se movió a otro mientras tanto, vuelve a preguntar.
       */}
      <input type="hidden" name="confirmaCierreDe" value={unidad?.corre?.circuitId ?? ""} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="buscar-unidad" className="text-[13px] text-[var(--tenue)]">
          Número económico
        </label>
        <input
          id="buscar-unidad"
          value={buscar}
          onChange={(e) => {
            setBuscar(e.target.value.replace(/\s/g, ""));
            setElegida(null);
          }}
          autoComplete="off"
          placeholder={unidades[0]?.numeroEconomico ?? ""}
          data-medida
          className={clases.campo}
          autoFocus
        />
      </div>

      {error && (
        <p role="alert" className={clases.aviso}>
          {error}
        </p>
      )}

      <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto" role="group" aria-label="Unidades">
        {lista.map((u) => (
          <Pieza
            key={u.unitId}
            // Libre u ocupada es asignación, no estado medido: va sin glifo
            // (skill: lo que liga sin afirmar estado, sin forma).
            nombre={u.numeroEconomico}
            apoyo={u.corre ? `asignada a ${u.corre.nombre ?? "otro circuito"}` : "sin circuito"}
            dato={u.corre ? "ocupada" : "libre"}
            etiqueta="unidad"
            edad={null}
            alTocar={() => setElegida(u.unitId)}
            seleccionada={elegida === u.unitId}
          />
        ))}
        {lista.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--linea)] px-4 py-3 text-[13px] text-[var(--tenue)]">
            {unidades.length === 0
              ? "No hay otra unidad activa de esta cuenta que se pueda asignar aquí"
              : `Ninguna unidad tiene ${buscar}`}
          </p>
        )}
      </div>

      {unidad && (
        <>
          <p className={clases.aviso}>
            <b>{unidad.numeroEconomico}</b> queda asignada a <b>{nombreDelCircuito}</b> desde ahora.
            {unidad.corre && (
              <>
                {" "}
                Sale de <b>{unidad.corre.nombre ?? "el circuito donde está"}</b>: esa asignación se cierra
                ahora, a tu nombre, con el motivo «Reasignada a {nombreDelCircuito}».
              </>
            )}
          </p>
          <p className={clases.nota}>
            Lo que corrió antes de este momento se queda donde lo corrió. Nada se reescribe.
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={clases.primario} disabled={!unidad}>
          {unidad?.corre ? `Mover a ${nombreDelCircuito}` : "Asignar"}
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function PanelSoltarUnidad({
  cuenta,
  circuitId,
  nombreDelCircuito,
  cancelar,
  error,
  asignacionId,
  numeroEconomico,
  sugerencias,
  motivoInicial,
}: Comunes & {
  asignacionId: string;
  numeroEconomico: string;
  sugerencias: readonly string[];
  motivoInicial: string;
}) {
  const [motivo, setMotivo] = useState(motivoInicial);
  const titulo = `Soltar ${numeroEconomico} de ${nombreDelCircuito}`;

  return (
    <form action="/api/casa/circuitos" method="post" className={clases.panel} aria-label={titulo}>
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        {titulo}
      </h3>
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value="soltar" />
      <input type="hidden" name="circuitId" value={circuitId} />
      <input type="hidden" name="assignmentId" value={asignacionId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="motivo" className="text-[13px] text-[var(--tenue)]">
          Motivo
        </label>
        <textarea
          id="motivo"
          name="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MOTIVO_MAX}
          rows={3}
          required
          aria-invalid={error ? true : undefined}
          className={`${clases.campo} min-h-16 resize-y text-[14px]`}
          autoFocus
        />
        <div className="flex flex-wrap gap-1.5">
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setMotivo(s)}
              className="cursor-pointer rounded-full border border-dashed border-[var(--linea)] px-2.5 py-1 text-[12.5px] text-[var(--tenue)] hover:border-[var(--tenue)] hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className={clases.aviso}>
          {error}
        </p>
      )}
      <p className={clases.nota}>
        Deja de estar asignada a este circuito desde ahora. Sus pasos de antes se quedan en su historia.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={clases.primario}>
          Soltar
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
