"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  explicarRechazoFranja,
  validarFranjas,
  type FranjaCapturada,
  type SentidoDeFranja,
  type TipoDeDiaCircuito,
} from "@jtel/domain";
import { DIAS, FRECUENCIA_MAX, SENTIDOS } from "@/lib/promesa-por-franja";

/**
 * **La promesa por franja** (Marco 9.1c) — la captura, en el expediente del
 * circuito de J-Staff.
 *
 * ## Por qué se ve así
 *
 * - **Se captura el conjunto, no un renglón.** Guardar cierra la versión vigente
 *   y abre otra con todas sus franjas (`savePromiseTable`, decisión 1 de Asav).
 *   Por eso aquí se edita todo y se guarda una vez, y la historia de versiones
 *   va abajo.
 * - **Todo o nada.** Si una franja se sale del horario o se encima con otra, no
 *   se guarda ninguna, y cada renglón rechazado dice por qué. La misma regla se
 *   corre aquí antes de mandar (`validarFranjas`), para que quien captura lo vea
 *   al teclear; el servidor la vuelve a correr.
 * - **Lo que ninguna franja cubre, no tiene promesa.** Un hueco dentro del
 *   horario es «sin promesa declarada» para ese tramo; no se rellena con la
 *   franja vecina (decisión 3). La pantalla lo avisa para que sea a propósito.
 * - **Nada aquí es un resultado**: acero y tenue, como el resto del expediente.
 */

type Fila = FranjaCapturada & { clave: number };

const mono = "font-[family-name:var(--fuente-mono)] tabular-nums";
const campo =
  "w-full rounded border border-[var(--linea)] bg-transparent px-2 py-1.5 text-[14px] text-[var(--texto)]";
const boton =
  "rounded border border-[var(--b-acero)] bg-[var(--t-acero)] px-4 py-2 text-[14px] font-medium text-[var(--acero)] hover:bg-[var(--t-acero2)] disabled:cursor-not-allowed disabled:opacity-50";
const secundario =
  "rounded border border-[var(--linea)] px-3 py-1.5 text-[13px] text-[var(--texto)] hover:bg-[var(--panel2)]";

let siguiente = 1;
const conClave = (f: FranjaCapturada): Fila => ({ ...f, clave: siguiente++ });

export interface VersionDeLaPromesa {
  id: string;
  desde: string;
  hasta: string | null;
  motivo: string | null;
  franjas: number;
}

export function CircuitoPromesa({
  circuitoId,
  horario,
  vigente,
  propuesta,
  ontoyHoy,
  historia,
}: {
  circuitoId: string;
  horario: { inicioLocal: string; finLocal: string };
  /** Las franjas de la versión vigente; `null` si nunca se capturó ninguna. */
  vigente: FranjaCapturada[] | null;
  /** Prellenado para un circuito que traía número único y ninguna franja. */
  propuesta: FranjaCapturada[];
  /** Lo que Ontoy publica HOY, del número único — hasta que el PR B lo mude. */
  ontoyHoy: string;
  historia: VersionDeLaPromesa[];
}) {
  const router = useRouter();
  const inicial = vigente ?? propuesta;
  const [filas, setFilas] = useState<Fila[]>(() => inicial.map(conClave));
  const [dia, setDia] = useState<TipoDeDiaCircuito>("entre_semana");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delServidor, setDelServidor] = useState<Map<number, string>>(new Map());
  const [guardada, setGuardada] = useState(false);

  // La misma regla que corre el servidor, al teclear. Una franja a medio llenar
  // (sin hora o sin frecuencia) no es rechazo todavía: es captura en curso.
  const completas = filas.filter((f) => f.desdeLocal && f.hastaLocal && f.frequencyMinutes > 0);
  const razones = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of completas) {
      if (f.desdeLocal >= f.hastaLocal) m.set(f.clave, `La franja ${f.desdeLocal}–${f.hastaLocal} termina antes de empezar.`);
    }
    const { rechazadas } = validarFranjas(
      completas.filter((f) => !m.has(f.clave)),
      { inicioLocal: horario.inicioLocal, finLocal: horario.finLocal },
    );
    for (const r of rechazadas) m.set((r.franja as Fila).clave, explicarRechazoFranja(r));
    for (const [k, v] of delServidor) if (!m.has(k)) m.set(k, v);
    return m;
  }, [completas, horario, delServidor]);

  const incompletas = filas.length - completas.length;
  const hayCambios = JSON.stringify(filas.map(({ clave: _c, ...f }) => f)) !== JSON.stringify(vigente ?? null);
  const pideMotivo = vigente !== null;
  const listo = hayCambios && razones.size === 0 && incompletas === 0 && (!pideMotivo || motivo.trim().length > 0);

  const delDia = filas.filter((f) => f.diaTipo === dia);
  const cambiar = (clave: number, cambio: Partial<FranjaCapturada>) => {
    setDelServidor(new Map());
    setGuardada(false);
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));
  };
  const agregar = () => {
    // La nueva arranca donde terminó la última del día: capturar pico y valle
    // es teclear sólo la hora del corte y la frecuencia.
    const ultima = [...delDia].sort((a, b) => a.hastaLocal.localeCompare(b.hastaLocal)).at(-1);
    setGuardada(false);
    setFilas((fs) => [
      ...fs,
      conClave({
        diaTipo: dia,
        sentido: null,
        desdeLocal: ultima?.hastaLocal ?? horario.inicioLocal.slice(0, 5),
        hastaLocal: horario.finLocal.slice(0, 5),
        frequencyMinutes: 0,
      }),
    ]);
  };
  const copiarEntreSemana = () => {
    setGuardada(false);
    setFilas((fs) => {
      const base = fs.filter((f) => f.diaTipo === "entre_semana");
      return [
        ...base,
        ...(["sabado", "domingo"] as const).flatMap((d) => base.map((f) => conClave({ ...f, diaTipo: d }))),
      ];
    });
  };

  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      const lista = filas.map(({ clave: _c, ...f }) => f);
      const r = await fetch(`/api/jstaff/circuitos/${circuitoId}/promesa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ franjas: lista, motivo }),
      });
      const cuerpo = (await r.json().catch(() => null)) as
        | { error?: string; rechazadas?: Array<{ indice: number; razon: string }> }
        | null;
      if (!r.ok) {
        setError(cuerpo?.error ?? "No se pudo guardar.");
        if (cuerpo?.rechazadas) {
          setDelServidor(new Map(cuerpo.rechazadas.map((x) => [filas[x.indice]!.clave, x.razon])));
        }
        return;
      }
      setMotivo("");
      setGuardada(true);
      router.refresh();
    } catch {
      setError("No se pudo guardar. Revisa la conexión y vuelve a intentarlo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Lado a lado mientras el PR B no mude a Ontoy: dos promesas distintas no pasan calladas. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-[var(--linea)] bg-[var(--panel2)] p-2.5">
          <p className={`${mono} text-[10.5px] tracking-[.1em] text-[var(--tenue)] uppercase`}>Ontoy publica hoy</p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--texto)]">{ontoyHoy}</p>
        </div>
        <div className="rounded border border-[var(--linea)] bg-[var(--panel2)] p-2.5">
          <p className={`${mono} text-[10.5px] tracking-[.1em] text-[var(--tenue)] uppercase`}>La torre mide contra</p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--texto)]">
            {vigente === null
              ? "Nada todavía: sin promesa capturada, la torre no tiene contra qué medir."
              : vigente.length === 0
                ? "Una promesa vacía: el concesionario no declara frecuencia."
                : `La promesa vigente: ${vigente.length} ${vigente.length === 1 ? "franja" : "franjas"}.`}
          </p>
        </div>
      </div>
      <p className="text-[12px] leading-snug text-[var(--tenue)]">
        La promesa tiene una sola fuente: estas franjas. Ontoy pasa a leerlas en el siguiente cambio; hasta entonces
        publica el número de arriba.
      </p>

      {vigente === null && propuesta.length > 0 && (
        <p className="rounded border border-[var(--b-acero)] bg-[var(--t-acero)] p-2.5 text-[12.5px] leading-snug text-[var(--texto)]">
          Prellenada con el número que el circuito ya declaraba, todo el horario, los tres tipos de día. Es una
          propuesta: no vale hasta que la guardes.
        </p>
      )}

      <div role="tablist" aria-label="Tipo de día" className="flex flex-wrap gap-1.5">
        {DIAS.map((d) => {
          const n = filas.filter((f) => f.diaTipo === d.tipo).length;
          return (
            <button
              key={d.tipo}
              type="button"
              role="tab"
              aria-selected={dia === d.tipo}
              onClick={() => setDia(d.tipo)}
              className={`rounded border px-3 py-1.5 text-[13px] ${
                dia === d.tipo
                  ? "border-[var(--b-acero)] bg-[var(--t-acero)] text-[var(--texto)]"
                  : "border-[var(--linea)] text-[var(--tenue)] hover:text-[var(--texto)]"
              }`}
            >
              {d.nombre} <span className={mono}>· {n}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[12px] leading-snug text-[var(--tenue)]">
        Horario de servicio <span className={mono}>{horario.inicioLocal.slice(0, 5)}–{horario.finLocal.slice(0, 5)}</span>:
        toda franja cabe dentro. Un tramo del horario que ninguna franja cubra queda <strong>sin promesa declarada</strong>{" "}
        — no se rellena con la franja vecina.
      </p>

      <ul className="space-y-2" aria-label={`Franjas · ${DIAS.find((d) => d.tipo === dia)!.nombre}`}>
        {delDia.length === 0 && (
          <li className="rounded border border-dashed border-[var(--linea)] px-3 py-3 text-[13px] text-[var(--tenue)]">
            Sin franjas este día: no se promete nada.
          </li>
        )}
        {delDia.map((f) => {
          const razon = razones.get(f.clave);
          return (
            <li
              key={f.clave}
              className={`rounded border p-2.5 ${razon ? "border-[var(--b-ambar)] bg-[var(--t-ambar)]" : "border-[var(--linea)]"}`}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_1.4fr_auto] sm:items-end">
                <label className="text-[11.5px] text-[var(--tenue)]">
                  Desde
                  <input type="time" value={f.desdeLocal} onChange={(e) => cambiar(f.clave, { desdeLocal: e.target.value })} className={`${campo} ${mono}`} />
                </label>
                <label className="text-[11.5px] text-[var(--tenue)]">
                  Hasta
                  <input type="time" value={f.hastaLocal} onChange={(e) => cambiar(f.clave, { hastaLocal: e.target.value })} className={`${campo} ${mono}`} />
                </label>
                <label className="text-[11.5px] text-[var(--tenue)]">
                  Cada (min)
                  <input
                    type="number"
                    min={1}
                    max={FRECUENCIA_MAX}
                    step={1}
                    value={f.frequencyMinutes || ""}
                    onChange={(e) => cambiar(f.clave, { frequencyMinutes: Number(e.target.value) || 0 })}
                    className={`${campo} ${mono}`}
                  />
                </label>
                <label className="text-[11.5px] text-[var(--tenue)]">
                  Sentido
                  <select
                    value={f.sentido ?? ""}
                    onChange={(e) => cambiar(f.clave, { sentido: (e.target.value || null) as SentidoDeFranja })}
                    className={campo}
                  >
                    {SENTIDOS.map((s) => (
                      <option key={s.nombre} value={s.valor ?? ""}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setGuardada(false);
                    setFilas((fs) => fs.filter((x) => x.clave !== f.clave));
                  }}
                  className={`${secundario} col-span-2 sm:col-span-1`}
                  aria-label={`Quitar la franja ${f.desdeLocal}–${f.hastaLocal}`}
                >
                  Quitar
                </button>
              </div>
              {razon && <p className="mt-2 text-[12.5px] leading-snug text-[var(--texto)]">⚠ {razon}</p>}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={agregar} className={secundario}>
          + Agregar franja
        </button>
        {dia === "entre_semana" && delDia.length > 0 && (
          <button type="button" onClick={copiarEntreSemana} className={secundario}>
            Copiar a sábado y domingo
          </button>
        )}
      </div>

      {pideMotivo && (
        <div>
          <label htmlFor="motivo-promesa" className="mb-1 block text-[12.5px] leading-snug text-[var(--texto)]">
            Por qué cambia la promesa
          </label>
          <input
            id="motivo-promesa"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={280}
            placeholder="Por ejemplo: el concesionario subió la frecuencia en hora pico"
            className={campo}
          />
          <p className="mt-1 text-[12px] leading-snug text-[var(--tenue)]">
            Queda escrito en la versión que se cierra. La nueva vale desde que la guardas; lo medido antes se sigue
            juzgando contra la que valía entonces.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-2.5 text-[13px] text-[var(--texto)]">
          ⚠ {error}
        </p>
      )}
      {guardada && (
        <p role="status" className="rounded border border-[var(--b-acero)] bg-[var(--t-acero)] p-2.5 text-[13px] text-[var(--texto)]">
          ✓ Guardada. Vale desde ahora; la versión anterior queda en la historia.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={!listo || enviando} className={boton}>
          {enviando ? "Guardando…" : "Guardar la promesa"}
        </button>
        <span className="text-[12px] text-[var(--tenue)]">
          {incompletas > 0
            ? `${incompletas} ${incompletas === 1 ? "franja" : "franjas"} a medio llenar.`
            : razones.size > 0
              ? "Corrige los renglones marcados: se guarda todo o nada."
              : !hayCambios
                ? "Sin cambios."
                : pideMotivo && !motivo.trim()
                  ? "Falta el motivo."
                  : `${filas.length} ${filas.length === 1 ? "franja" : "franjas"}, las tres pestañas juntas.`}
        </span>
      </div>

      {historia.length > 0 && (
        <div className="border-t border-[var(--linea-tenue)] pt-3">
          <p className={`${mono} text-[10.5px] tracking-[.1em] text-[var(--tenue)] uppercase`}>Versiones de la promesa</p>
          <ul className="mt-2 divide-y divide-[var(--linea-tenue)] rounded border border-[var(--linea)]">
            {historia.map((v) => (
              <li key={v.id} className="px-3 py-2 text-[12.5px] leading-snug">
                <span className={`${mono} text-[var(--texto)]`}>
                  {v.desde} → {v.hasta ?? "vigente"}
                </span>{" "}
                <span className="text-[var(--tenue)]">
                  · {v.franjas} {v.franjas === 1 ? "franja" : "franjas"}
                  {v.motivo ? ` · terminó: ${v.motivo}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
