"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Qué unidades corren este circuito, desde cuándo, y cuáles dejaron de correrlo.
 *
 * ## Por qué esta pantalla se ve así
 *
 * **La asignación tiene vigencia, no se pisa.** Una unidad puede correr el
 * circuito hoy y maquila mañana. Terminar una asignación la cierra con su hora y
 * su motivo; no borra nada. Por eso la pantalla enseña las dos partes: lo
 * vigente arriba, la historia debajo. Una lista que solo mostrara lo vigente
 * dejaría a quien mira sin saber si una unidad se retiró o si nunca estuvo.
 *
 * **Ningún cierre ocurre callado.** Un camión corre un circuito a la vez, así
 * que asignar una unidad ocupada termina su asignación anterior. Eso se avisa
 * ANTES de confirmar, con el nombre del circuito que dejaría de correr.
 *
 * **Nada aquí es un resultado.** Vigente y terminada son estados de operación:
 * van en acero y tenue. El verde, el ámbar y el rojo son de los veredictos del
 * árbitro y no entran a esta pantalla.
 */

export interface AsignacionEnPantalla {
  id: string;
  unitId: string;
  unitLabel: string;
  plateNumber: string | null;
  carrierName: string;
  validFrom: string;
  validTo: string | null;
  motivo: string | null;
}

export interface UnidadAsignable {
  unitId: string;
  label: string;
  plateNumber: string | null;
  carrierName: string;
  ocupadaEnCircuitoId: string | null;
  ocupadaEnCircuito: string | null;
  ocupadaDesde: string | null;
}

const mono = "font-[family-name:var(--fuente-mono)] tabular-nums";

export function CircuitoUnidades({
  circuitoId,
  zonaHoraria,
  asignacionesIniciales,
  asignablesIniciales,
}: {
  circuitoId: string;
  zonaHoraria: string;
  asignacionesIniciales: AsignacionEnPantalla[];
  asignablesIniciales: UnidadAsignable[];
}) {
  const [asignaciones, setAsignaciones] = useState(asignacionesIniciales);
  const [asignables, setAsignables] = useState(asignablesIniciales);
  const [elegida, setElegida] = useState("");
  const [terminando, setTerminando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fecha completa, en la zona del circuito.
   *
   * Completa porque una hora suelta no sostiene nada: el servicio de este
   * circuito arranca antes del amanecer y una asignación puede cruzar la
   * medianoche. Y en la zona del circuito —no la del navegador— porque quien
   * mira desde otra ciudad tiene que leer la hora que vivió el despachador.
   */
  const fecha = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zonaHoraria,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(new Date(iso))
        .replace(",", ""),
    [zonaHoraria],
  );

  const vigentes = useMemo(() => asignaciones.filter((a) => !a.validTo), [asignaciones]);
  const terminadas = useMemo(() => asignaciones.filter((a) => a.validTo), [asignaciones]);
  const unidadElegida = asignables.find((u) => u.unitId === elegida) ?? null;

  const recargar = useCallback(async () => {
    const r = await fetch(`/api/jstaff/circuitos/${circuitoId}/unidades`);
    if (!r.ok) return;
    const datos = (await r.json()) as {
      asignaciones: AsignacionEnPantalla[];
      asignables: UnidadAsignable[];
    };
    setAsignaciones(datos.asignaciones);
    setAsignables(datos.asignables);
  }, [circuitoId]);

  const asignar = useCallback(async () => {
    if (!unidadElegida) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await fetch(`/api/jstaff/circuitos/${circuitoId}/unidades`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unidadId: unidadElegida.unitId }),
      });
      const datos = (await r.json()) as { error?: string };
      if (!r.ok) {
        setError(datos.error ?? "No se pudo asignar");
        return;
      }
      setElegida("");
      await recargar();
    } finally {
      setOcupado(false);
    }
  }, [circuitoId, recargar, unidadElegida]);

  const terminar = useCallback(
    async (asignacionId: string) => {
      setOcupado(true);
      setError(null);
      try {
        const liga = `/api/jstaff/circuitos/${circuitoId}/unidades/${asignacionId}?motivo=${encodeURIComponent(motivo.trim())}`;
        const r = await fetch(liga, { method: "DELETE" });
        const datos = (await r.json()) as { error?: string };
        if (!r.ok) {
          setError(datos.error ?? "No se pudo terminar");
          return;
        }
        setTerminando(null);
        setMotivo("");
        await recargar();
      } finally {
        setOcupado(false);
      }
    },
    [circuitoId, motivo, recargar],
  );

  return (
    <section className="mt-6 border-t border-[var(--linea)] pt-6">
      <h3 className="text-[15px] font-semibold text-[var(--texto)]">
        Unidades que corren este circuito
      </h3>
      <p className="mt-1 text-xs text-[var(--tenue)]">
        Fuera de asignación vigente, una unidad no se publica. Terminar una asignación no la
        borra: la cierra con su hora y su motivo.
      </p>

      {error && (
        <p className="mt-3 rounded border border-[var(--linea-fuerte)] px-3 py-2 text-sm text-[var(--texto)]">
          {error}
        </p>
      )}

      {/* ── Vigentes ─────────────────────────────────────────────────── */}
      <div className="mt-4">
        {vigentes.length === 0 ? (
          <p className="rounded border border-dashed border-[var(--linea)] px-3 py-4 text-sm text-[var(--tenue)]">
            Ninguna unidad asignada — este circuito no publica ninguna unidad.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--linea-tenue)] rounded border border-[var(--linea)]">
            {vigentes.map((a) => (
              <li key={a.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`${mono} text-sm text-[var(--texto)]`}>{a.unitLabel}</span>
                  {a.plateNumber && (
                    <span className={`${mono} text-xs text-[var(--tenue)]`}>{a.plateNumber}</span>
                  )}
                  <span className="text-xs text-[var(--tenue)]">{a.carrierName}</span>
                  <span className={`${mono} text-xs text-[var(--acero)]`}>
                    Desde {fecha(a.validFrom)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTerminando(terminando === a.id ? null : a.id);
                      setMotivo("");
                    }}
                    className="ml-auto rounded border border-[var(--linea-fuerte)] px-2.5 py-1 text-xs text-[var(--texto)] hover:border-[var(--azul)] hover:text-[var(--azul)]"
                  >
                    Terminar
                  </button>
                </div>

                {terminando === a.id && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--linea-tenue)] pt-2.5">
                    <label className="text-xs text-[var(--tenue)]" htmlFor={`motivo-${a.id}`}>
                      Por qué deja de correrlo
                    </label>
                    <input
                      id={`motivo-${a.id}`}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="se fue a maquila · entró a taller"
                      className="min-w-[240px] flex-1 rounded border border-[var(--linea)] bg-[var(--panel2)] px-2 py-1 text-sm text-[var(--texto)] placeholder:text-[var(--tenue)]"
                    />
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => terminar(a.id)}
                      className="rounded border border-[var(--azul)]/50 bg-[var(--azul)]/10 px-3 py-1 text-xs font-medium text-[var(--azul)] hover:bg-[var(--azul)]/20 disabled:opacity-50"
                    >
                      Terminar asignación
                    </button>
                    <button
                      type="button"
                      onClick={() => setTerminando(null)}
                      className="rounded border border-[var(--linea-fuerte)] px-2.5 py-1 text-xs text-[var(--texto)]"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Asignar ──────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[280px] flex-1">
          <label className="mb-1 block text-xs text-[var(--tenue)]" htmlFor="unidad-asignable">
            Asignar una unidad
          </label>
          <select
            id="unidad-asignable"
            value={elegida}
            onChange={(e) => setElegida(e.target.value)}
            className="w-full rounded border border-[var(--linea)] bg-[var(--panel2)] px-2 py-1.5 text-sm text-[var(--texto)]"
          >
            <option value="">Elige una unidad…</option>
            {asignables
              .filter((u) => u.ocupadaEnCircuitoId !== circuitoId)
              .map((u) => (
                <option key={u.unitId} value={u.unitId}>
                  {u.label}
                  {u.plateNumber ? ` · ${u.plateNumber}` : ""} — {u.carrierName}
                  {u.ocupadaEnCircuito ? ` (corre ${u.ocupadaEnCircuito})` : ""}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!elegida || ocupado}
          onClick={asignar}
          className="rounded border border-[var(--azul)]/50 bg-[var(--azul)]/10 px-4 py-2 text-sm font-medium text-[var(--azul)] hover:bg-[var(--azul)]/20 disabled:opacity-50"
        >
          Asignar al circuito
        </button>
      </div>

      {/*
        El aviso sale ANTES de confirmar y nombra el circuito que se pierde.
        Reasignar en silencio una unidad que estaba corriendo otra cosa es
        exactamente lo que esta pantalla existe para no hacer.
      */}
      {unidadElegida?.ocupadaEnCircuito && (
        <p className="mt-2 rounded border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-2 text-xs text-[var(--texto)]">
          <span className={mono}>{unidadElegida.label}</span> corre{" "}
          <span className={mono}>{unidadElegida.ocupadaEnCircuito}</span>
          {unidadElegida.ocupadaDesde && (
            <span className={`${mono} text-[var(--acero)]`}> desde {fecha(unidadElegida.ocupadaDesde)}</span>
          )}
          . Al asignarla aquí, aquella asignación termina.
        </p>
      )}

      {asignables.length === 0 && (
        <p className="mt-2 text-xs text-[var(--tenue)]">
          Ningún transportista ligado a esta concesión tiene unidades activas. La liga
          concesión–transportista es la que abre este universo.
        </p>
      )}

      {/* ── Historia ─────────────────────────────────────────────────── */}
      {terminadas.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs uppercase tracking-[.13em] text-[var(--tenue)]">
            Asignaciones terminadas
          </h4>
          <ul className="mt-2 space-y-1.5">
            {terminadas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-2.5 text-xs">
                <span className={`${mono} text-[var(--texto)]`}>{a.unitLabel}</span>
                <span className={`${mono} text-[var(--acero)]`}>
                  {fecha(a.validFrom)} → {fecha(a.validTo as string)}
                </span>
                <span className="text-[var(--tenue)]">
                  {a.motivo ?? "sin motivo anotado"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
