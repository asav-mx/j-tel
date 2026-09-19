"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { horaCorta, localDateIso, type Veredicto } from "@jtel/domain";
import type { OcurrenciaDeLaLista } from "@jtel/services";
import { Glifo } from "@/components/casa/glifo";
import { Pieza } from "@/components/casa/pieza";
import { BarraDePeriodo } from "@/components/casa/barra-de-periodo";
import type { Periodo } from "@/lib/casa/periodo";
import {
  GLIFO_DEL_VEREDICTO,
  SIN_FILTROS,
  VEREDICTOS,
  bloques,
  conteos,
  fechaCorta,
  hayFilaDeContratos,
  laLista,
  loQueSeCuenta,
  palabraDelConteo,
  rutaDelActa,
  rutaDelCuarto,
  turnosDeLaVentana,
  type Filtros,
} from "@/lib/casa/servicios-especiales";

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]";

/** Un chip que prende y apaga. Activo = borde y letra en tinta; la forma del borde lo dice, no un color. */
function Chip({
  activo,
  alTocar,
  medida = false,
  children,
}: {
  activo: boolean;
  alTocar: () => void;
  medida?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={alTocar}
      data-medida={medida || undefined}
      className={`cursor-pointer rounded-full border px-3 py-1 ${medida ? "text-[12px]" : "text-[12.5px]"} transition-colors ${
        activo ? "border-[var(--tinta)] text-[var(--tinta)]" : "border-[var(--linea)] text-[var(--tenue)] hover:text-[var(--tinta)]"
      } ${foco}`}
    >
      {children}
    </button>
  );
}

/**
 * La hora del sello en la pieza: la hora sola si se selló el mismo día civil
 * de la ocurrencia; con su fecha si no (un re-sello días después no puede
 * pasar por el sello del mismo día).
 */
function horaDelSello(o: OcurrenciaDeLaLista, zona: string): string {
  const sello = new Date(o.selladoAt);
  const dia = localDateIso(sello, zona);
  return dia === o.fecha ? horaCorta(sello, zona) : `${fechaCorta(dia)} ${horaCorta(sello, zona)}`;
}

/**
 * Servicios especiales — la lista (ficha Vernier §2).
 *
 * La ventana vive en la dirección: cambiarla pide la lista al servidor. Todo
 * lo demás —contrato, turno, búsqueda, chip de veredicto— es una lente
 * instantánea sobre lo que ya llegó, y los conteos cuentan exactamente lo que
 * las piezas de abajo muestran, sin el chip de veredicto (la ley de coherencia).
 *
 * Cero cobre: nada aquí está vivo. Cero dinero: la consecuencia vive en el
 * estado de cuenta futuro.
 */
export function ListaDeServiciosEspeciales({
  ocurrencias,
  contratos,
  zona,
  periodo,
  leida,
  slug,
  cuentaEnRuta,
  diaDeLaVentana,
}: {
  ocurrencias: OcurrenciaDeLaLista[];
  contratos: Array<{ id: string; nombre: string }>;
  zona: string;
  periodo: Periodo;
  leida: number;
  slug: string;
  cuentaEnRuta: string | null;
  diaDeLaVentana: string | null;
}) {
  const router = useRouter();
  const [leyendo, empezar] = useTransition();
  const [f, setF] = useState<Filtros>(SIN_FILTROS);
  const poner = (x: Partial<Filtros>) => setF((viejo) => ({ ...viejo, ...x }));

  const base = useMemo(() => loQueSeCuenta(ocurrencias, f), [ocurrencias, f]);
  const cuenta = useMemo(() => conteos(base), [base]);
  const lista = useMemo(() => laLista(base, f.veredicto), [base, f.veredicto]);
  const grupos = useMemo(() => bloques(lista, diaDeLaVentana), [lista, diaDeLaVentana]);
  const turnos = useMemo(() => turnosDeLaVentana(ocurrencias, f.contratoId), [ocurrencias, f.contratoId]);

  const elegir = (p: Periodo) => empezar(() => router.push(rutaDelCuarto(cuentaEnRuta, p)));

  return (
    <div className="flex flex-col">
      <BarraDePeriodo
        periodo={periodo}
        acotado={false}
        leida={leida}
        reloj={leida}
        leyendo={leyendo}
        slug={slug}
        zona={zona}
        elegir={elegir}
      />

      {hayFilaDeContratos(contratos) && (
        <div role="group" aria-label="Contratos" className="mb-2 flex flex-wrap gap-1.5">
          <Chip activo={f.contratoId === null} alTocar={() => poner({ contratoId: null, turnoId: null })}>
            Todos los contratos
          </Chip>
          {contratos.map((c) => (
            <Chip key={c.id} activo={f.contratoId === c.id} alTocar={() => poner({ contratoId: c.id, turnoId: null })}>
              {c.nombre}
            </Chip>
          ))}
        </div>
      )}

      {turnos.length > 0 && (
        <div role="group" aria-label="Turnos" className="mb-4 flex flex-wrap gap-1.5">
          {turnos.map((t) => (
            <Chip
              key={t.id}
              medida
              activo={f.turnoId === t.id}
              alTocar={() => poner({ turnoId: f.turnoId === t.id ? null : t.id })}
            >
              {t.nombre} · {t.ventana}
            </Chip>
          ))}
        </div>
      )}

      <label htmlFor="buscar-servicios" className="sr-only">
        Buscar en la ventana
      </label>
      <input
        id="buscar-servicios"
        type="search"
        value={f.q}
        onChange={(e) => poner({ q: e.target.value })}
        placeholder="Buscar en la ventana: ruta, unidad, turno, fecha, contrato o veredicto…"
        className={`mb-3.5 w-full rounded-[10px] border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[14px] placeholder:text-[var(--tenue)] ${foco}`}
      />

      <div
        role="group"
        aria-label="Conteos de lo que la lista muestra"
        className="mb-6 flex flex-wrap items-center gap-1.5 border-y border-[var(--linea)] py-3"
      >
        <span data-medida className="mr-2 text-[13.5px]">
          {cuenta.total === 1 ? "1 servicio" : `${cuenta.total} servicios`}
        </span>
        {VEREDICTOS.map((v: Veredicto) => (
          <button
            key={v}
            type="button"
            aria-pressed={f.veredicto === v}
            onClick={() => poner({ veredicto: f.veredicto === v ? null : v })}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] text-[var(--tenue)] ${
              f.veredicto === v ? "border-[var(--tinta)]" : "border-transparent hover:border-[var(--linea)]"
            } ${foco}`}
          >
            <Glifo estado={GLIFO_DEL_VEREDICTO[v]} tamano={15} />
            <span data-medida className="text-[13.5px] text-[var(--tinta)]">
              {cuenta[v]}
            </span>
            <span>{palabraDelConteo(v, cuenta[v])}</span>
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--linea)] px-6 py-7 text-center text-[14px] text-[var(--tenue)]">
          Nada en esta ventana con ese filtro.
        </div>
      ) : (
        grupos.map((b) => (
          <section key={b.clave} className="mb-6" aria-label={b.titulo}>
            <h2 data-medida className="mb-2.5 text-[10.5px] uppercase tracking-[0.2em] text-[var(--tenue)]">
              {b.titulo}
            </h2>
            <div className="flex flex-col gap-2">
              {b.piezas.map((o) => (
                <Pieza
                  key={o.id}
                  estado={GLIFO_DEL_VEREDICTO[o.veredicto]}
                  nombre={o.ruta}
                  apoyo={[o.contrato.nombre, o.motivo.corto, o.unidadObservada ? `unidad ${o.unidadObservada}` : "sin unidad observada"].join(" · ")}
                  dato={horaDelSello(o, zona)}
                  etiqueta={o.resellado ? "re-sellado" : "sellado"}
                  edad={null}
                  datoNoCumplido={o.veredicto === "no_cumplido"}
                  apoyoQueEnvuelve
                  ficha={rutaDelActa(o.id, cuentaEnRuta)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
