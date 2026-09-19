"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Chip, FilaDeChips } from "@/components/casa/chips";
import { Pieza } from "@/components/casa/pieza";
import {
  CAJONES,
  CHIPS,
  PLEGADAS,
  buscarEnTodo,
  conteosDeChips,
  hayBusqueda,
  laBase,
  nombreDelCajon,
  piezasQuePidenAtencion,
  rutaDelCajon,
  seccionesDelCajon,
  tarjetaDeCajon,
  type Archivero,
  type Cajon,
  type PiezaDelArchivero,
} from "@/lib/casa/archivero";

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]";

/** El título de una sección: mono, mayúsculas chicas, con su cuenta. */
function TituloDeSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h2 data-medida className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-[var(--tenue)]">
      {children}
    </h2>
  );
}

function Fila({ p }: { p: PiezaDelArchivero }) {
  return (
    <Pieza
      compacta
      estado={p.glifo ?? undefined}
      nombre={p.nombre}
      apoyo={p.apoyo}
      dato={p.dato}
      etiqueta={p.etiqueta}
      // El dato de un dispositivo ya es la edad de su señal; el de una unidad,
      // un conteo de papeles, que no es algo vivo.
      edad={null}
      datoVivo={p.datoVivo}
      apagada={p.apagada}
      ficha={p.ficha ?? undefined}
    />
  );
}

function Lista({ piezas }: { piezas: PiezaDelArchivero[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {piezas.map((p) => (
        <Fila key={`${p.cajon}-${p.id}`} p={p} />
      ))}
    </div>
  );
}

function Buscador({ id, valor, alCambiar, placeholder, etiqueta }: { id: string; valor: string; alCambiar: (q: string) => void; placeholder: string; etiqueta: string }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <input
        id={id}
        type="search"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-[10px] border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[14px] placeholder:text-[var(--tenue)] ${foco}`}
      />
    </>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-[var(--linea)] px-4 py-3 text-[13px] text-[var(--tenue)]">{children}</div>;
}

// ── Nivel 1 · el tablero ─────────────────────────────────────────────────

/**
 * El tablero (ficha V2 §2): el buscador que atraviesa los cajones arriba de
 * todo, «Piden atención» como bandeja del día, y las tarjetas de los cajones.
 * Mientras hay texto, el tablero se reemplaza por los resultados agrupados por
 * cajón; al borrarlo, vuelve.
 */
export function TableroDelArchivero({ archivero, cuentaEnRuta }: { archivero: Archivero; cuentaEnRuta: string | null }) {
  const [q, setQ] = useState("");
  const buscando = hayBusqueda(q);
  const resultados = useMemo(() => (buscando ? buscarEnTodo(archivero, q) : null), [archivero, q, buscando]);
  const atencion = useMemo(() => piezasQuePidenAtencion(archivero), [archivero]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <Buscador
          id="buscar-archivero"
          etiqueta="Buscar en todo el archivero"
          valor={q}
          alCambiar={setQ}
          // Corto: a 375 px uno largo se cortaba a media palabra. Los campos van abajo.
          placeholder="Buscar en todo el archivero…"
        />
        <p className="text-[12px] text-[var(--tenue)]">
          Unidad, placa, VIN, dispositivo, IMEI o chofer: salen las coincidencias de todos los cajones. Vacío, ves el tablero.
        </p>
      </div>

      {resultados ? (
        <Resultados resultados={resultados} q={q} />
      ) : (
        <>
          <section aria-label="Piden atención">
            <TituloDeSeccion>Piden atención · {atencion.length}</TituloDeSeccion>
            {atencion.length === 0 ? <Vacio>Nada pide atención.</Vacio> : <Lista piezas={atencion} />}
          </section>

          <section aria-label="Los cajones">
            <TituloDeSeccion>Los cajones</TituloDeSeccion>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CAJONES.map((c) => (
                <Tarjeta key={c} cajon={c} piezas={archivero[c]} cuentaEnRuta={cuentaEnRuta} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Resultados({ resultados, q }: { resultados: Archivero; q: string }) {
  const conAlgo = CAJONES.filter((c) => resultados[c].length > 0);
  if (conAlgo.length === 0) return <Vacio>Nada coincide con «{q.trim()}» en ningún cajón.</Vacio>;
  return (
    <div className="flex flex-col gap-6">
      {conAlgo.map((c) => (
        <section key={c} aria-label={nombreDelCajon(c)}>
          <TituloDeSeccion>
            {nombreDelCajon(c)} · {resultados[c].length}
          </TituloDeSeccion>
          <Lista piezas={resultados[c]} />
        </section>
      ))}
    </div>
  );
}

function Tarjeta({ cajon, piezas, cuentaEnRuta }: { cajon: Cajon; piezas: PiezaDelArchivero[]; cuentaEnRuta: string | null }) {
  const t = tarjetaDeCajon(cajon, piezas);
  return (
    <Link
      href={rutaDelCajon(cajon, cuentaEnRuta)}
      className={`flex min-h-[128px] flex-col gap-1.5 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] px-4 pb-3.5 pt-4 transition-colors hover:bg-[var(--roce)] ${foco}`}
    >
      <span className="flex items-baseline justify-between">
        <span data-medida className="text-[10.5px] uppercase tracking-[0.2em] text-[var(--tenue)]">
          {t.nombre}
        </span>
        <span aria-hidden="true" className="text-[18px] leading-none text-[var(--tenue)]">
          ›
        </span>
      </span>
      <span className="text-[32px] leading-none" style={{ fontFamily: "var(--letra-titular)", fontWeight: 800, letterSpacing: "-0.03em" }}>
        {t.cifra}
      </span>
      <span className="mt-auto text-[12.5px] leading-snug text-[var(--tenue)]">
        {t.vacio ?? (
          <>
            {t.piden && <b className="font-semibold text-[var(--tinta)]">{t.piden}</b>}
            {t.piden && t.partes.length > 0 && (cajon === "dispositivos" ? <br /> : " · ")}
            {t.partes.join(" · ")}
          </>
        )}
      </span>
    </Link>
  );
}

// ── Nivel 2 · un cajón ───────────────────────────────────────────────────

const PLACEHOLDER: Record<Cajon, string> = {
  unidades: "Buscar unidad: número, placa o VIN…",
  dispositivos: "Buscar dispositivo: nombre, IMEI o unidad…",
  choferes: "Buscar chofer: nombre o licencia…",
};

/**
 * La lista de un cajón (ficha V2 §3): chips con su rótulo VER, buscador propio
 * y las piezas en filas compactas, por secciones. Lo inactivo o de baja va
 * plegado al final, fuera de los chips, con su propia cuenta.
 */
export function ListaDelCajon({ cajon, piezas, mercado }: { cajon: Cajon; piezas: PiezaDelArchivero[]; mercado: string | null }) {
  const chips = CHIPS[cajon];
  const [chip, setChip] = useState(chips[0]?.clave ?? "");
  const [q, setQ] = useState("");
  const base = useMemo(() => laBase(piezas, q), [piezas, q]);
  const conteos = useMemo(() => conteosDeChips(cajon, base), [cajon, base]);
  const { secciones, plegadas } = useMemo(() => seccionesDelCajon(cajon, base, chip, mercado), [cajon, base, chip, mercado]);

  if (piezas.length === 0) {
    const vacio = tarjetaDeCajon(cajon, piezas).vacio;
    return <Vacio>{vacio}</Vacio>;
  }

  return (
    <div className="flex flex-col gap-5">
      {chips.length > 0 && (
        <FilaDeChips rotulo="Ver">
          {chips.map((c) => (
            <Chip key={c.clave} activo={chip === c.clave} alTocar={() => setChip(c.clave)}>
              {c.nombre} <span data-medida className="ml-1 text-[11.5px]">{conteos[c.clave]}</span>
            </Chip>
          ))}
        </FilaDeChips>
      )}

      <Buscador id={`buscar-${cajon}`} etiqueta={`Buscar en ${nombreDelCajon(cajon)}`} valor={q} alCambiar={setQ} placeholder={PLACEHOLDER[cajon]} />

      {secciones.length === 0 && plegadas.length === 0 && (
        <Vacio>{hayBusqueda(q) ? `Nada coincide con «${q.trim()}» en ${nombreDelCajon(cajon)}.` : "Nada con ese filtro."}</Vacio>
      )}

      {secciones.map((s) => (
        <section key={s.clave} aria-label={s.titulo}>
          <TituloDeSeccion>
            {s.titulo} · {s.piezas.length}
          </TituloDeSeccion>
          {s.explicacion.map((linea) => (
            <p key={linea} className="-mt-1 mb-2.5 text-[12.5px] text-[var(--tinta)]">
              {linea}
            </p>
          ))}
          <Lista piezas={s.piezas} />
        </section>
      ))}

      {plegadas.length > 0 && (
        /* No se esconden: su historia queda. Plegadas al final para no ahogar lo que está en servicio. */
        <details className="group flex flex-col">
          <summary className={`flex cursor-pointer list-none items-baseline justify-between gap-3 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-2.5 text-[13px] text-[var(--tenue)] ${foco}`}>
            <span>{PLEGADAS[cajon]}</span>
            <span data-medida className="text-[13px]">
              {plegadas.length} · <span className="group-open:hidden">ver</span>
              <span className="hidden group-open:inline">ocultar</span>
            </span>
          </summary>
          <div className="mt-2">
            <Lista piezas={plegadas} />
          </div>
        </details>
      )}
    </div>
  );
}
