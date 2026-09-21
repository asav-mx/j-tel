"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";

/**
 * Declarar la unidad desde el acta (ficha de huecos de «asignar unidad», PR 1).
 *
 * **Reusa la escritura de la pantalla vieja** —`POST /api/carrier/aportaciones`,
 * la de `CajaAportacion`— y no inventa una segunda. Esa ruta escribe sólo
 * `carrier_aportaciones` y un asiento de bitácora; no tiene forma de tocar el
 * hecho (0022).
 *
 * Tres cosas que la pantalla dice porque son ciertas, y en ese orden:
 *
 *  1. **Es una aportación, no un veredicto.** El sello no cambia; va a la
 *     planta, que la contesta.
 *  2. **Es declarada, no observada** (Pieza 1.C). El acta la muestra con esa
 *     palabra, en su propia caja, lejos del renglón «Unidad observada».
 *  3. **Sólo sus unidades.** El selector sale de su flota y la ruta vuelve a
 *     comprobarlo contra la cuenta.
 */
export function DeclararUnidad({
  cuenta,
  ocurrenciaId,
  unidades,
}: {
  cuenta: string;
  ocurrenciaId: string;
  unidades: { id: string; etiqueta: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [unidad, setUnidad] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  if (!abierto) {
    return (
      <div className="flex flex-col gap-2">
        {enviada && (
          <p role="status" className={clases.nota}>
            Enviada a la planta. Es una aportación: el sello no cambia.
          </p>
        )}
        <div>
          <button type="button" className={clases.abridor(false)} onClick={() => setAbierto(true)}>
            Declarar la unidad
          </button>
        </div>
      </div>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!unidad) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch("/api/carrier/aportaciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: cuenta,
          occurrenceId: ocurrenciaId,
          declaredUnitId: unidad,
          nota: nota.trim() || null,
        }),
      });
      const cuerpo = (await r.json().catch(() => null)) as { error?: string; detalle?: string } | null;
      if (!r.ok) {
        setError(cuerpo?.detalle ?? cuerpo?.error ?? "No se pudo enviar. Vuelve a intentarlo.");
        return;
      }
      setAbierto(false);
      setUnidad("");
      setNota("");
      setEnviada(true);
      // La lista de aportaciones se vuelve a leer de la base, no se dibuja de lo tecleado.
      router.refresh();
    } catch {
      setError("No se pudo enviar. Revisa la conexión y vuelve a intentarlo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className={clases.panel} aria-label="Declarar la unidad">
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        Declarar la unidad
      </h3>
      <p className="text-[13.5px] leading-relaxed">
        El sello no acreditó ninguna unidad. Si sabes cuál dio este servicio, dilo aquí.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="unidad-declarada" className="text-[13px] text-[var(--tenue)]">
          Unidad
        </label>
        <select
          id="unidad-declarada"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          required
          data-medida
          className={clases.campo}
          autoFocus
        >
          <option value="">Elige una de tus unidades</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nota-declarada" className="text-[13px] text-[var(--tenue)]">
          Nota (opcional)
        </label>
        <textarea
          id="nota-declarada"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={600}
          rows={2}
          placeholder="Por ejemplo: el GPS de esa unidad estaba fallando ese día"
          className={`${clases.campo} min-h-12 resize-y text-[14px]`}
        />
      </div>

      {error && (
        <p role="alert" className={clases.aviso}>
          {error}
        </p>
      )}
      <p className={clases.nota}>
        Es una aportación, no un veredicto: el sello no cambia. Va a la planta, que la contesta. En el acta queda como
        unidad <b>declarada</b>, nunca como observada.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={clases.primario} disabled={!unidad || enviando}>
          {enviando ? "Enviando…" : "Enviar a la planta"}
        </button>
        <button type="button" className={clases.secundario} onClick={() => setAbierto(false)} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
