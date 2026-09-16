"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GRUPOS_DE_UNIDAD } from "@jtel/domain";
import { Pieza } from "@/components/casa/pieza";
import { Latido } from "@/components/casa/glifo";
import { Encabezado, Titular, Vacio } from "@/components/casa/expediente";
import { edad } from "@/lib/casa/expedientes";
import {
  LECTURA_CADA_MS,
  NOMBRE_DE_GRUPO,
  type DatoDePieza,
  type FlotaEnVivoParaPantalla,
  type UnidadEnVivo,
} from "@/lib/casa/flota";

// Leaflet toca `window` al importarse: el mapa sólo existe en el navegador.
const MapaFlota = dynamic(() => import("@/components/casa/mapa-flota").then((m) => m.MapaFlota), { ssr: false });

/**
 * Flota en vivo, la parte que corre en el navegador.
 *
 * Tres relojes, cada uno con su razón:
 *
 * - **Cada segundo** se reescriben las edades. La lectura trae instantes, no
 *   textos: «hace 14 s» escrito en el servidor sería mentira a los diez
 *   segundos.
 * - **Cada 30 s** se pide una lectura nueva: es la cadencia real del
 *   recolector de Compás; pedir más seguido repite el mismo dato.
 * - **El reloj del servidor**, no el del teléfono: la edad se mide contra la
 *   hora en que el servidor leyó, corregida por lo que tardó en llegar. Un
 *   teléfono adelantado cinco minutos no debe envejecer la flota entera.
 *
 * Si una lectura falla, lo último que se vio **se queda y se dice de cuándo
 * es**: una flota que desaparece por un error de red afirma que no hay flota.
 */
export function FlotaEnVivo({ inicial, slug }: { inicial: FlotaEnVivoParaPantalla; slug: string }) {
  const [datos, setDatos] = useState(inicial);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [vista, setVista] = useState<"lista" | "mapa">("lista");
  const [fallo, setFallo] = useState(false);
  /** Milisegundos que el reloj del servidor le lleva al del navegador. */
  const desfase = useRef(0);
  const [ahora, setAhora] = useState(() => new Date(inicial.leidaIso));

  useEffect(() => {
    desfase.current = new Date(inicial.leidaIso).getTime() - Date.now();
    const t = setInterval(() => setAhora(new Date(Date.now() + desfase.current)), 1000);
    return () => clearInterval(t);
  }, [inicial.leidaIso]);

  const leer = useCallback(async () => {
    try {
      const enRuta = inicial.cuentaEnRuta ? "&enRuta=1" : "";
      const r = await fetch(`/api/casa/flota?account=${encodeURIComponent(slug)}${enRuta}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const nuevos = (await r.json()) as FlotaEnVivoParaPantalla;
      desfase.current = new Date(nuevos.leidaIso).getTime() - Date.now();
      setDatos(nuevos);
      setFallo(false);
    } catch {
      setFallo(true);
    }
  }, [slug, inicial.cuentaEnRuta]);

  useEffect(() => {
    const t = setInterval(() => {
      // Con la pestaña escondida no se lee: nadie está mirando.
      if (document.visibilityState === "visible") void leer();
    }, LECTURA_CADA_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void leer();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [leer]);

  const leida = new Date(datos.leidaIso);
  const porGrupo = useMemo(
    () => GRUPOS_DE_UNIDAD.map((g) => ({ grupo: g, unidades: datos.unidades.filter((u) => u.grupo === g) })),
    [datos.unidades],
  );
  const señalada = datos.unidades.find((u) => u.id === seleccion) ?? null;

  const señalar = (id: string) => {
    setSeleccion(id);
    // En celular, tocar una pieza lleva al mapa: ahí es donde se señala.
    if (window.matchMedia("(max-width: 767px)").matches) setVista("mapa");
  };

  const bajo = [
    datos.cuenta,
    datos.unidades.length === 1 ? "1 unidad" : `${datos.unidades.length} unidades`,
    fallo ? `sin actualizar · última lectura ${edad(leida, ahora)}` : `actualizado ${edad(leida, ahora)}`,
  ].join(" · ");

  return (
    <div className="flex flex-col gap-4 md:grid md:h-[calc(100dvh-9.5rem)] md:grid-cols-[380px_1fr] md:gap-0">
      <div className="flex min-h-0 flex-col gap-4 md:overflow-y-auto md:border-r md:border-[var(--linea)] md:pr-5">
        <div className="flex items-start gap-2.5">
          {!fallo && (
            <span className="mt-[14px] flex-none">
              <Latido />
            </span>
          )}
          <Titular nombre="Flota en vivo" bajo={bajo} />
        </div>

        {/* Celular: una cosa a la vez. El interruptor arriba y ya. */}
        <div role="group" aria-label="Vista" className="inline-flex self-start md:hidden">
          {(["lista", "mapa"] as const).map((v, i) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => setVista(v)}
              className={`cursor-pointer border border-[var(--linea)] bg-[var(--pieza)] px-4 py-1.5 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)] ${
                i === 0 ? "rounded-l-lg" : "-ml-px rounded-r-lg"
              } ${vista === v ? "font-semibold text-[var(--tinta)]" : "text-[var(--tenue)]"}`}
            >
              {v === "lista" ? "Lista" : "Mapa"}
            </button>
          ))}
        </div>

        <div className={`flex flex-col gap-5 pb-4 ${vista === "mapa" ? "hidden md:flex" : ""}`}>
          {datos.unidades.length === 0 && <Vacio>Sin unidades dadas de alta</Vacio>}
          {porGrupo
            .filter((g) => g.unidades.length > 0)
            .map((g) => (
              <section key={g.grupo} className="flex flex-col gap-2" aria-label={NOMBRE_DE_GRUPO[g.grupo]}>
                <Encabezado izquierda={`${NOMBRE_DE_GRUPO[g.grupo]} · ${g.unidades.length}`} />
                {g.unidades.map((u) => {
                  const d = textoDeDato(u.dato, ahora);
                  return (
                    <Pieza
                      key={u.id}
                      estado={u.glifo}
                      rumbo={u.rumbo ?? undefined}
                      nombre={u.nombre}
                      apoyo={u.apoyo}
                      dato={d.dato}
                      etiqueta={d.etiqueta}
                      datoVivo={d.vivo}
                      // El dato ya es la edad o la hora de llegada: no se repite abajo.
                      edad={null}
                      apagada={u.apagada}
                      alTocar={() => señalar(u.id)}
                      seleccionada={u.id === seleccion}
                    />
                  );
                })}
              </section>
            ))}
          {datos.unidadesInactivas > 0 && (
            <p data-medida className="text-[12px] text-[var(--tenue)]">
              {datos.unidadesInactivas === 1 ? "1 unidad inactiva" : `${datos.unidadesInactivas} unidades inactivas`} · no
              están en operación
            </p>
          )}
        </div>
      </div>

      <div
        className={`relative h-[calc(100dvh-15rem)] min-h-[360px] overflow-hidden rounded-lg border border-[var(--linea)] md:h-full md:rounded-none md:border-0 ${
          vista === "lista" ? "hidden md:block" : ""
        }`}
      >
        <MapaFlota
          unidades={datos.unidades}
          lugares={datos.lugares}
          seleccion={seleccion}
          alSeleccionar={setSeleccion}
        />
        {señalada && <FichaEnMapa unidad={señalada} ahora={ahora} />}
      </div>
    </div>
  );
}

function textoDeDato(d: DatoDePieza, ahora: Date): { dato: string; etiqueta: string; vivo: boolean } {
  switch (d.tipo) {
    case "edad":
      return { dato: edad(new Date(d.desdeIso), ahora), etiqueta: d.etiqueta, vivo: d.vivo };
    case "hora":
      return { dato: d.texto, etiqueta: d.etiqueta, vivo: false };
    case "ninguno":
      return { dato: "—", etiqueta: d.etiqueta, vivo: false };
  }
}

/** La unidad señalada, sobre el mapa, con el camino a su ficha. */
function FichaEnMapa({ unidad, ahora }: { unidad: UnidadEnVivo; ahora: Date }) {
  const d = textoDeDato(unidad.dato, ahora);
  return (
    <div className="absolute bottom-3 left-3 z-[500] flex max-w-[calc(100%-1.5rem)] flex-col gap-0.5 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[13px]">
      <span className="text-[17px] leading-tight" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700 }}>
        {unidad.nombre}
      </span>
      <span className="text-[var(--tenue)]">
        {NOMBRE_DE_GRUPO[unidad.grupo]} · {unidad.apoyo}
      </span>
      <span data-medida className="text-[var(--tenue)]">
        {d.etiqueta} {d.dato}
      </span>
      {!unidad.posicion && <span className="text-[var(--tenue)]">Sin posición que dibujar</span>}
      <Link
        href={unidad.ficha}
        className="mt-1 self-start text-[var(--tinta)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
      >
        Ver {unidad.nombre}
      </Link>
    </div>
  );
}
