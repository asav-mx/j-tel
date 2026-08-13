"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Tu versión de este servicio — la caja de reconciliación.
 *
 * Ficha: `docs/marco-limpio/Ficha-Reconciliacion.md`.
 * Va **debajo del expediente sin atribución**, que es donde el árbitro acaba de
 * decir que no pudo atribuir.
 *
 * ---
 *
 * **Las dos leyes, y dónde se ven:**
 *
 * 1. *Agrega contexto, NUNCA cambia el veredicto.* No hay un solo control que
 *    toque el resultado, y el encabezado lo dice antes de que el usuario
 *    escriba nada — no al pie, donde ya aportó creyendo otra cosa.
 * 2. *La planta decide si mueve algo.* Por eso lo enviado se muestra con su
 *    estado y nunca se anuncia como resuelto.
 *
 * **El vocabulario no es cosmético.** Se escribe «tu versión», «aportar», «la
 * planta lo revisa». **No** «apelación», «disputa» ni «defensa»: eso convierte
 * cada servicio en un litigio y le enseña al transportista que el camino normal
 * es pelear. La palabra de la casa es **reconciliar**.
 */

export type AportacionVista = {
  id: string;
  motivo: string | null;
  nota: string | null;
  unidadEtiqueta: string | null;
  adjuntos: Array<{ nombre: string; url: string }>;
  estado: "enviada" | "vista" | "resuelta" | "retirada";
  creadaAt: string;
  resolucionNota: string | null;
};

const ESTADO_TEXTO: Record<AportacionVista["estado"], string> = {
  enviada: "Enviada · la planta todavía no la ha visto",
  vista: "Vista por la planta",
  // `resuelta` = contestó. NO = aceptó. Que la pantalla no lo confunda es la
  // ley 2: qué consecuencia tiene es enforcement, y está sin decidir.
  resuelta: "La planta respondió",
  retirada: "Retirada por ti",
};

/** Etiquetas de los excusables del contrato. El catálogo viene de la política. */
const ETIQUETA_MOTIVO: Record<string, string> = {
  lluvia_nieve: "Lluvia o nieve",
  marchas: "Marchas o bloqueo",
  obstruccion: "Obstrucción en la vía",
  falla_mecanica: "Falla mecánica",
  ponchadura: "Ponchadura",
  obra_sin_aviso: "Obra sin aviso",
};

function etiquetaDe(codigo: string): string {
  return ETIQUETA_MOTIVO[codigo] ?? codigo.replace(/_/g, " ");
}

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace(",", "");
}

/** Lo que el día de una unidad dice, con la ventana como frontera declarada. */
type RecorridoDia = {
  ok: boolean;
  sinAparato?: boolean;
  mensaje?: string;
  total?: number;
  dentro?: number;
  antes?: number;
  despues?: number;
  primero?: string | null;
  ultimo?: string | null;
};

function soloHora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function CajaAportacion({
  occurrenceId,
  accountSlug,
  catalogo,
  unidades,
  existentes,
  empalmePorUnidad = {},
}: {
  occurrenceId: string;
  accountSlug: string;
  /** Los excusables que la política del contrato declara. Puede venir vacío. */
  catalogo: string[];
  unidades: Array<{ id: string; label: string }>;
  existentes: AportacionVista[];
  /**
   * Qué OTRA ruta acreditó cada unidad ese día — el empalme, ya derivado por la
   * página. Solo llega el nombre cuando la otra ruta es de este mismo cliente:
   * de lo contrario viene sin nombre, porque nombrarla sería contar la
   * operación de un tercero (Ley 3).
   */
  empalmePorUnidad?: Record<string, { rutaNombre: string | null }>;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const [unidad, setUnidad] = useState("");
  const [dia, setDia] = useState<RecorridoDia | null>(null);
  const [cargandoDia, setCargandoDia] = useState(false);
  const [adjuntoNombre, setAdjuntoNombre] = useState("");
  const [adjuntoUrl, setAdjuntoUrl] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vacio = !motivo && !nota.trim() && !unidad && !adjuntoUrl.trim();
  const empalme = unidad ? empalmePorUnidad[unidad] : undefined;

  /**
   * Al declarar una unidad se trae su día COMPLETO.
   *
   * No es un adorno: la ventana es la frontera de lo que el árbitro miró, y en
   * la población de ventana corta **el 100 %** tiene puntos de la misma
   * candidata antes de que su ventana abriera. Aquí es donde el transportista
   * puede enseñarlo — **para mirar, no para re-calificar**.
   */
  async function elegirUnidad(id: string) {
    setUnidad(id);
    setDia(null);
    if (!id) return;
    setCargandoDia(true);
    try {
      const res = await fetch(
        `/api/carrier/recorrido-dia?account=${encodeURIComponent(accountSlug)}` +
          `&occurrenceId=${encodeURIComponent(occurrenceId)}&unitId=${encodeURIComponent(id)}`,
      );
      setDia(res.ok ? ((await res.json()) as RecorridoDia) : null);
    } catch {
      setDia(null);
    } finally {
      setCargandoDia(false);
    }
  }

  /**
   * Señalar el empalme: lo escribe el TRANSPORTISTA, no el sistema.
   *
   * La pantalla ya sabía el hecho y lo enseñaba como renglón informativo. Que él
   * lo invoque lo convierte en **afirmación suya, con su firma** — que es lo que
   * la planta necesita para resolver. Y **no dice «por eso no acreditó aquí»**:
   * esa conclusión es C18 y sigue sin construir.
   */
  function señalarEmpalme() {
    if (!empalme) return;
    const frase = empalme.rutaNombre
      ? `Esta unidad cubrió también ${empalme.rutaNombre} en ese turno.`
      : "Esta unidad cubrió otro servicio en ese turno.";
    setNota((n) => (n.trim() ? `${n.trim()}\n${frase}` : frase));
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/carrier/aportaciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: accountSlug,
          occurrenceId,
          motivo: motivo || null,
          nota: nota.trim() || null,
          declaredUnitId: unidad || null,
          adjuntos: adjuntoUrl.trim()
            ? [{ nombre: adjuntoNombre.trim() || adjuntoUrl.trim(), url: adjuntoUrl.trim() }]
            : [],
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(json?.error ?? "No se pudo registrar");
        return;
      }
      setMotivo("");
      setNota("");
      setUnidad("");
      setAdjuntoNombre("");
      setAdjuntoUrl("");
      router.refresh();
    } catch {
      setError("No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section
      className="rounded-[10px] border p-5"
      style={{ borderColor: "var(--linea)", background: "var(--panel)" }}
    >
      <h2
        className="text-[17px] font-semibold tracking-[-.02em]"
        style={{ color: "var(--texto)" }}
      >
        Tu versión de este servicio
      </h2>
      {/*
       * La ley 1, antes de que el usuario escriba nada. Al pie llegaría tarde:
       * habría aportado creyendo que esto mueve su calificación.
       */}
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--tenue)" }}>
        El resultado ya está sellado y <strong>esto no lo cambia</strong>. Lo que
        aportes queda junto al expediente, con tu firma y su hora, y lo revisa la
        planta.
      </p>

      {existentes.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {existentes.map((a) => (
            <li
              key={a.id}
              className="rounded-[8px] border p-3"
              style={{
                borderColor: "var(--linea)",
                // Retirada: se atenúa, NO se esconde. Lo que se dijo se dijo.
                opacity: a.estado === "retirada" ? 0.6 : 1,
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px]" style={{ color: "var(--texto)" }}>
                  {a.motivo ? etiquetaDe(a.motivo) : "Sin motivo del catálogo"}
                </span>
                <span
                  className="font-mono text-[11px] tabular-nums"
                  style={{ color: "var(--tenue)" }}
                >
                  {fechaCorta(a.creadaAt)}
                </span>
              </div>
              {a.nota ? (
                <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--texto)" }}>
                  {a.nota}
                </p>
              ) : null}
              {a.unidadEtiqueta ? (
                <p className="mt-1 font-mono text-[11.5px]" style={{ color: "var(--tenue)" }}>
                  Unidad que declaras: {a.unidadEtiqueta}
                </p>
              ) : null}
              {a.adjuntos.length > 0 ? (
                <p className="mt-1 font-mono text-[11.5px]" style={{ color: "var(--tenue)" }}>
                  {a.adjuntos.length} adjunto{a.adjuntos.length === 1 ? "" : "s"}
                </p>
              ) : null}
              <p
                className="mt-2 font-mono text-[10px] uppercase tracking-[.12em]"
                style={{ color: "var(--tenue)" }}
              >
                {ESTADO_TEXTO[a.estado]}
              </p>
              {a.resolucionNota ? (
                <p
                  className="mt-1.5 border-t pt-1.5 text-[12.5px]"
                  style={{ borderColor: "var(--linea-tenue)", color: "var(--texto)" }}
                >
                  {a.resolucionNota}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-3">
        {catalogo.length > 0 ? (
          <label className="block">
            <span className="text-[12px]" style={{ color: "var(--tenue)" }}>
              Motivo · del catálogo de este contrato
            </span>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1 w-full rounded-[6px] border px-2.5 py-1.5 text-[13px]"
              style={{
                borderColor: "var(--linea)",
                background: "var(--panel2)",
                color: "var(--texto)",
              }}
            >
              <option value="">Sin motivo del catálogo</option>
              {catalogo.map((c) => (
                <option key={c} value={c}>
                  {etiquetaDe(c)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          /*
           * Sin catálogo no se inventa uno: se dice. Los excusables son política
           * del contrato, y ofrecer una lista que el contrato no pactó sería
           * dejar aportar contra una regla que no existe.
           */
          <p className="text-[12px]" style={{ color: "var(--tenue)" }}>
            Este contrato no tiene motivos configurados. Puedes aportar con una nota.
          </p>
        )}

        <label className="block">
          <span className="text-[12px]" style={{ color: "var(--tenue)" }}>
            Qué pasó
          </span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-[6px] border px-2.5 py-1.5 text-[13px]"
            style={{
              borderColor: "var(--linea)",
              background: "var(--panel2)",
              color: "var(--texto)",
            }}
          />
        </label>

        <label className="block">
          <span className="text-[12px]" style={{ color: "var(--tenue)" }}>
            Unidad que dices que cubrió la ruta
          </span>
          <select
            value={unidad}
            onChange={(e) => void elegirUnidad(e.target.value)}
            className="mt-1 w-full rounded-[6px] border px-2.5 py-1.5 text-[13px]"
            style={{
              borderColor: "var(--linea)",
              background: "var(--panel2)",
              color: "var(--texto)",
            }}
          >
            <option value="">Sin declarar</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          {/* Es su dicho, no una acreditación. Que la pantalla no lo confunda. */}
          <span className="mt-1 block text-[11.5px]" style={{ color: "var(--tenue)" }}>
            Queda registrado como lo que declaras, no como unidad acreditada.
          </span>
        </label>

        {/*
         * El día completo de esa unidad. Los tres tramos van SEPARADOS —antes,
         * dentro y después— porque sumarlos borraría la frontera con la que se
         * juzgó, que es justo lo que esta pieza existe para enseñar.
         */}
        {cargandoDia ? (
          <p className="text-[12px]" style={{ color: "var(--tenue)" }}>
            Buscando su recorrido del día…
          </p>
        ) : dia ? (
          <div
            className="rounded-[8px] border p-3"
            style={{ borderColor: "var(--b-acero)", background: "var(--t-acero)" }}
          >
            {dia.sinAparato ? (
              <p className="text-[12.5px]" style={{ color: "var(--tenue)" }}>
                {dia.mensaje}
              </p>
            ) : (dia.total ?? 0) === 0 ? (
              <p className="text-[12.5px]" style={{ color: "var(--tenue)" }}>
                No hay rastro de esta unidad ese día. No es cero recorrido: es que
                el sistema no recibió puntos suyos.
              </p>
            ) : (
              <>
                <p className="text-[12.5px]" style={{ color: "var(--texto)" }}>
                  <strong>Su día completo:</strong> {dia.total} puntos, de{" "}
                  <span className="font-mono">{soloHora(dia.primero!)}</span> a{" "}
                  <span className="font-mono">{soloHora(dia.ultimo!)}</span>.
                </p>
                <p className="mt-1 font-mono text-[11.5px]" style={{ color: "var(--tenue)" }}>
                  {dia.antes} antes de la ventana · {dia.dentro} dentro ·{" "}
                  {dia.despues} después
                </p>
                {(dia.antes ?? 0) > 0 ? (
                  <p className="mt-1.5 text-[12px]" style={{ color: "var(--texto)" }}>
                    Hubo {dia.antes} puntos suyos <strong>antes de que el árbitro
                    empezara a mirar</strong>.
                  </p>
                ) : null}
                {/*
                 * La ley, en la pantalla y no solo en la ficha: el árbitro
                 * decidió con la ventana. Si un dato de fuera moviera un
                 * resultado, la ventana dejaría de ser la frontera de nada.
                 */}
                <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tenue)" }}>
                  Fuera de la ventana es evidencia para mirar, no parte del
                  resultado: el árbitro juzgó con la ventana.
                </p>
              </>
            )}
          </div>
        ) : null}

        {/* El empalme, invocable — el hecho pasa a ser afirmación suya. */}
        {empalme ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-[8px] border p-3"
            style={{ borderColor: "var(--linea)" }}
          >
            <span className="text-[12.5px]" style={{ color: "var(--texto)" }}>
              {empalme.rutaNombre
                ? `Esta unidad acreditó ${empalme.rutaNombre} ese mismo turno.`
                : "Esta unidad cubrió otro servicio ese mismo turno."}
            </span>
            <button
              type="button"
              onClick={señalarEmpalme}
              className="rounded-[6px] border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[.12em]"
              style={{ borderColor: "var(--b-acero)", color: "var(--acero)" }}
            >
              Señalarlo en mi versión
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px]" style={{ color: "var(--tenue)" }}>
              Adjunto · nombre
            </span>
            <input
              value={adjuntoNombre}
              onChange={(e) => setAdjuntoNombre(e.target.value)}
              className="mt-1 w-full rounded-[6px] border px-2.5 py-1.5 text-[13px]"
              style={{
                borderColor: "var(--linea)",
                background: "var(--panel2)",
                color: "var(--texto)",
              }}
            />
          </label>
          <label className="block">
            <span className="text-[12px]" style={{ color: "var(--tenue)" }}>
              Adjunto · enlace
            </span>
            <input
              value={adjuntoUrl}
              onChange={(e) => setAdjuntoUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-[6px] border px-2.5 py-1.5 text-[13px]"
              style={{
                borderColor: "var(--linea)",
                background: "var(--panel2)",
                color: "var(--texto)",
              }}
            />
          </label>
        </div>

        {error ? (
          <p className="text-[12.5px]" style={{ color: "var(--rojo)" }}>
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || vacio}
            className="rounded-[6px] border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[.12em] disabled:opacity-50"
            style={{ borderColor: "var(--b-acero)", color: "var(--acero)" }}
          >
            {enviando ? "Enviando…" : "Aportar"}
          </button>
          <span className="text-[11.5px]" style={{ color: "var(--tenue)" }}>
            Se guarda con tu firma y la hora. No se puede borrar; sí retirar.
          </span>
        </div>
      </div>
    </section>
  );
}
