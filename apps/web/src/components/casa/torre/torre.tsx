"use client";

import { useEffect, useMemo, useState } from "react";
import { Glifo } from "@/components/casa/glifo";
import { Carril } from "@/components/casa/torre/carril";
import { Detalle } from "@/components/casa/torre/detalle";
import { Instrumento } from "@/components/casa/torre/instrumento";
import {
  abscisasDeParadas,
  glifoDeLaUnidad,
  laPromesaPide,
  palabraDeLaPromesa,
  queDibujaLaTorre,
  textoDelInstrumentoVacio,
  textoDeEspera,
  textoDeReferencia,
  textoDelIntervalo,
  type AbscisaDeParada,
} from "@/lib/casa/torre";
import type { Sentido } from "@jtel/domain";
import type { TorreDelCircuito, UnidadEnLaTorre } from "@jtel/services";

/** Lo que la página le entrega a la torre, además de lo que la capa midió. */
export interface VistaDeLaTorre {
  nombreDelCircuito: string;
  zona: string;
  paradas: Array<{ stopId: string; nombre: string; lat: number; lon: number; sentido: Sentido | null; orden: number }>;
  trazados: Array<{ sentido: Sentido; coordinates: Array<[number, number]> }>;
  /** El rótulo de cada sentido: «IDA · OASIS → CENTRO». Sale de las paradas, no se inventa. */
  rotulos: Record<Sentido, string>;
  /** Los sentidos con carril, de «lo mínimo para medir» (capa de servicios). */
  carriles: Sentido[];
  /** De la misma definición: asignadas, no al aire. */
  hayUnidadesAsignadas: boolean;
}

type Torre = Extract<TorreDelCircuito, { alcance: "concesion" | "carrier" }>;

const SENTIDOS: Sentido[] = ["ida", "vuelta"];

/** `hace 14 s` · `hace 3.8 h` — la edad que el skill exige en todo dato vivo. */
function edad(segundos: number): string {
  if (segundos < 120) return `hace ${Math.floor(segundos)} s`;
  if (segundos < 7200) return `hace ${Math.floor(segundos / 60)} min`;
  return `hace ${(segundos / 3600).toFixed(1)} h`;
}

export function Torre({ torre, vista }: { torre: Torre; vista: VistaDeLaTorre }) {
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [sentidoMovil, setSentidoMovil] = useState<Sentido>("ida");

  /*
   * El reloj corre en el navegador desde la hora del servidor, y sólo después
   * de montar: arrancarlo en el primer dibujo daría una hora distinta en el
   * servidor y en el cliente. **La espera de una parada es el único dato de
   * esta pantalla que cambia frente a quien la mira** (9.2d), y verlo crecer es
   * la diferencia entre un número y una alarma que avanza.
   */
  const [corrido, setCorrido] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCorrido((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const abscisas = useMemo(() => {
    const por = {} as Record<Sentido, AbscisaDeParada[]>;
    for (const s of SENTIDOS) {
      por[s] = abscisasDeParadas(
        vista.paradas,
        vista.trazados.find((t) => t.sentido === s)?.coordinates ?? null,
        s,
      );
    }
    return por;
  }, [vista.paradas, vista.trazados]);

  const edadDe = (u: UnidadEnLaTorre) =>
    u.ultimaPosicion ? edad(u.ultimaPosicion.antiguedadSeg + corrido) : "sin señal";

  const esperaCorrida = (e: Torre["esperas"][number]) =>
    e.minutos === null ? e : { ...e, minutos: e.minutos + corrido / 60 };

  const unidadesDe = (s: Sentido) =>
    torre.unidades.filter((u) => u.sobreElCorredor?.sentido === s);

  const sinPromesa = torre.unidades.some((u) => u.promesa.motivo === "sin_promesa");
  const alTocar = (id: string) => setSeleccion((antes) => (antes === id ? null : id));

  /* ── El estado vacío: sólo cuando no hay carril que dibujar ───────────── */
  const dibujo = queDibujaLaTorre(vista.carriles, vista.paradas.length, vista.hayUnidadesAsignadas);
  if (dibujo.tipo === "vacia") {
    return (
      <>
        <FranjaVacia torre={torre} paradas={vista.paradas.length} unidades={torre.unidades.length} />
        <div className="rounded-2xl border border-[var(--linea)] bg-[var(--pieza)] px-6 py-14 text-center">
          <div className="text-[15px] leading-snug text-[var(--tenue)]">{dibujo.titulo}</div>
          <div className="mt-2 text-[12.5px] leading-relaxed text-[var(--tenue)]">{dibujo.explicacion}</div>
        </div>
      </>
    );
  }
  const { sentidos, sinUnidadesAsignadas } = dibujo;
  // En celular, un sentido sin carril no se ofrece: se cae al primero que sí lo tiene.
  const sentidoEnCelular = sentidos.includes(sentidoMovil) ? sentidoMovil : sentidos[0]!;

  const detalle = armarDetalle(seleccion, torre, vista);

  return (
    <>
      <div className="my-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3">
        <Par rubro="Promesa" valor={promesaEnPalabras(torre)} />
        <Par rubro="Rango" valor={rangoEnPalabras(torre)} />
        <Par
          rubro="Sostenimiento desde la apertura"
          valor={
            torre.sostenimiento
              ? `${torre.sostenimiento.enRango} de ${torre.sostenimiento.medidos} en rango`
              : "aún no disponible"
          }
          barra={
            torre.sostenimiento && torre.sostenimiento.medidos > 0
              ? torre.sostenimiento.enRango / torre.sostenimiento.medidos
              : null
          }
        />
        {sinUnidadesAsignadas ? (
          <Par rubro="Unidades asignadas" valor="0" />
        ) : (
          <Par
            rubro="Al aire"
            valor={`${torre.unidades.filter((u) => u.situacion === "en_ruta").length} de ${torre.unidades.length}`}
          />
        )}
      </div>

      {sinUnidadesAsignadas && (
        /*
         * Sin unidades asignadas la capa no corre el reloj de ninguna parada
         * (no hay a quién corregir por radio); por eso el aviso dice las dos
         * cosas que faltan, y no sólo los camiones.
         */
        <Aviso>
          Sin unidades asignadas · aquí aparecen las unidades, y la espera de cada parada, cuando el circuito las tenga
          asignadas.
        </Aviso>
      )}
      {torre.flujo === "incompleto" && (
        <Aviso>
          Aún no disponible · este circuito lo corre más de un transportista. Se muestra dónde va cada unidad tuya y
          desde cuándo; el ritmo y la espera se miden contra el servicio completo, que esta cuenta no ve.
        </Aviso>
      )}
      {sinPromesa && torre.flujo === "completo" && (
        /*
         * «De esta franja» era falso y se veía: la barra de arriba muestra la
         * promesa vigente AHORA y este aviso hablaba de los pasos, que
         * ocurrieron antes y pueden caer en otra franja — o en un hueco del
         * horario. Dos afirmaciones que se contradecían en la misma pantalla
         * (Marco §D). Ahora dice de qué habla.
         */
        <Aviso>
          Hay pasos medidos en una franja sin promesa capturada: de ésos no se dice nada, porque no hay tabla contra
          qué compararlos. Se captura en la tabla de horario del circuito.
        </Aviso>
      )}

      <section
        aria-label="La torre del circuito"
        className="mb-2.5 rounded-2xl border border-[var(--linea)] bg-[var(--pieza)] pb-2 pt-4"
      >
        {/* Computadora: los dos carriles. Lo ancho se desplaza dentro de su caja. */}
        <div className="hidden overflow-x-auto px-[18px] md:block">
          <div className="relative min-w-[980px]">
            {sentidos.map((s) => (
              <div key={s} className="border-t border-[var(--linea)] pt-3.5 first:border-t-0 first:pt-0">
                <Carril
                  sentido={s}
                  rotulo={vista.rotulos[s]}
                  abscisas={abscisas[s]}
                  unidades={unidadesDe(s)}
                  esperas={torre.esperas.map(esperaCorrida)}
                  ritmo={torre.ritmo.disponible && torre.ritmo.sentido === s ? torre.ritmo : null}
                  porQueSinRitmo={torre.ritmo.disponible ? null : porQueSinRitmo(torre.ritmo)}
                  edadDe={edadDe}
                  seleccion={seleccion}
                  alTocar={alTocar}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Celular: un sentido a la vez, el corredor vertical. Una decisión por pantalla. */}
        <div className="px-4 md:hidden">
          <div role="tablist" aria-label="Sentido" className="mb-3.5 flex gap-1.5 rounded-xl border border-[var(--linea)] p-1">
            {sentidos.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={sentidoEnCelular === s}
                onClick={() => setSentidoMovil(s)}
                className={`flex-1 cursor-pointer rounded-lg border-0 px-1 py-2.5 text-[11px] uppercase tracking-[0.12em] ${
                  sentidoEnCelular === s ? "bg-[var(--roce)] text-[var(--tinta)]" : "bg-transparent text-[var(--tenue)]"
                }`}
              >
                {vista.rotulos[s]}
              </button>
            ))}
          </div>
          <CarrilVertical
            abscisas={abscisas[sentidoEnCelular]}
            unidades={unidadesDe(sentidoEnCelular)}
            esperas={torre.esperas.map(esperaCorrida).filter((e) => e.sentido === sentidoEnCelular)}
            edadDe={edadDe}
            seleccion={seleccion}
            alTocar={alTocar}
          />
        </div>

        {/* La clave explica camiones y el reloj en cobre: sin unidades asignadas no hay ninguno de los dos. */}
        {!sinUnidadesAsignadas && <Clave />}
      </section>

      {detalle && <Detalle {...detalle} zona={vista.zona} alCerrar={() => setSeleccion(null)} />}

      <section aria-label="Unidades del circuito" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {torre.unidades.map((u) => (
          <PiezaDeUnidad
            key={u.unitId}
            u={u}
            edad={edadDe(u)}
            seleccionada={seleccion === `unidad:${u.unitId}`}
            alTocar={() => alTocar(`unidad:${u.unitId}`)}
          />
        ))}
      </section>
    </>
  );
}

/**
 * Por qué el carril del ritmo va vacío. **9.2e exige que lo declare**: un riel
 * en blanco se lee como «no hay nada que decir», y lo que pasa es que no hay
 * vueltas medidas con qué colocar la referencia. El hueco se dice (1.E).
 */
function porQueSinRitmo(ritmo: Extract<Torre["ritmo"], { disponible: false }>): string {
  switch (ritmo.motivo) {
    case "sin_tramos":
      return "sin vueltas medidas todavía";
    case "perfil_incompleto":
      return `faltan ${ritmo.tramosSinMedir ?? 0} tramos por medir`;
    case "sin_promesa":
      return "sin promesa capturada para esta franja";
    case "flujo_incompleto":
      return "no se dibuja sobre un flujo incompleto";
    case "fuera_de_horario":
      return "el circuito está cerrado";
    default:
      return "sin vueltas medidas todavía";
  }
}

/**
 * Para qué lado va la unidad. **Sin una sola posición no se dice «fuera del
 * corredor»**: afirmaría dónde está un camión que nadie ha visto (Marco §D).
 */
function dondeVa(u: UnidadEnLaTorre): string {
  if (!u.ultimaPosicion) return "sin una sola posición";
  return u.sobreElCorredor?.sentido ?? "fuera del corredor";
}

function Par({ rubro, valor, barra }: { rubro: string; valor: string; barra?: number | null }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--tenue)]">{rubro}</span>
      <span data-medida className="text-[13px]">
        {valor}
      </span>
      {barra !== null && barra !== undefined && (
        <span
          aria-hidden="true"
          className="inline-block h-[7px] w-14 overflow-hidden rounded border border-[var(--linea)] bg-[var(--roce)]"
        >
          <span className="block h-full bg-[var(--tinta)]" style={{ width: `${Math.round(barra * 100)}%` }} />
        </span>
      )}
    </span>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--tenue)]">
      {children}
    </p>
  );
}

function FranjaVacia({ torre, paradas, unidades }: { torre: Torre; paradas: number; unidades: number }) {
  return (
    <div className="my-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3">
      <Par rubro="Promesa por franja" valor={promesaEnPalabras(torre)} />
      <Par rubro="Paradas" valor={`${paradas}`} />
      <Par rubro="Unidades asignadas" valor={`${unidades}`} />
    </div>
  );
}

/**
 * La promesa de la franja vigente. **La emite la capa aparte** (`promesaVigente`)
 * y no se deduce de las referencias de las unidades: bajo la compuerta del 9.14
 * ninguna unidad trae banda, y deducirla de ahí hacía que la barra dijera
 * «promesa sin capturar» de un circuito que sí la tiene. La promesa es pública;
 * lo reservado es el resultado de medirla.
 */
function referenciaVigente(torre: Torre) {
  return torre.promesaVigente;
}

function promesaEnPalabras(torre: Torre): string {
  const r = referenciaVigente(torre);
  return r ? `cada ${Math.round(r.frecuenciaMin)} min` : "sin capturar";
}

function rangoEnPalabras(torre: Torre): string {
  const r = referenciaVigente(torre);
  return r ? `${textoDeReferencia(r).replace("rango ", "")} min` : "—";
}

function Clave() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 px-[18px] pb-2 pt-3 text-[11px] leading-snug text-[var(--tenue)]">
      <span className="flex items-center gap-1.5">
        <Glifo estado="en-movimiento" tamano={16} /> en movimiento
      </span>
      <span className="flex items-center gap-1.5">
        <Glifo estado="detenida" tamano={16} /> detenida
      </span>
      <span className="flex items-center gap-1.5">
        <Glifo estado="sin-senal" tamano={16} /> sin señal · última posición conocida
      </span>
      <span className="flex items-center gap-1.5">
        <svg viewBox="0 0 24 10" aria-hidden="true" className="h-2.5 w-6">
          <path d="M1 2 V8 M23 2 V8 M1 5 H23" stroke="var(--tenue)" strokeWidth="1.3" fill="none" />
          <path d="M12 3.5 L9 7 L15 7 Z" fill="none" stroke="var(--tenue)" strokeWidth="1.2" />
        </svg>
        ritmo prometido — referencia, no es una unidad
      </span>
      <span>
        bajo cada parada: cuánto lleva sin que pase nadie ·{" "}
        <span className="font-medium text-[var(--senal)]">en cobre cuando ya se pasó del rango — ese reloj corre</span>
      </span>
    </div>
  );
}

function PiezaDeUnidad({
  u,
  edad,
  seleccionada,
  alTocar,
}: {
  u: UnidadEnLaTorre;
  edad: string;
  seleccionada: boolean;
  alTocar: () => void;
}) {
  const pide = laPromesaPide(u.promesa);
  /*
   * `null` = el instrumento NO se dibuja. Fuera de horario, sin arrancar o sin
   * salir, no hay nada contra qué medir y un eje vacío con una leyenda de más
   * afirmaría un hueco que no existe: la pregunta no viene al caso.
   */
  const vacio = textoDelInstrumentoVacio(u.promesa);
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-pressed={seleccionada}
      className={`w-full cursor-pointer rounded-[13px] border bg-[var(--pieza)] px-4 pb-3 pt-3.5 text-left ${
        seleccionada ? "border-[var(--tinta)]" : "border-[var(--linea)]"
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]`}
    >
      <span className="flex items-start gap-3">
        <span className="mt-0.5 flex-none">
          <Glifo estado={glifoDeLaUnidad(u)} rumbo={u.rumboGrados ?? 0} tamano={24} />
        </span>
        <span className="min-w-0">
          <span className="block text-[21px] font-bold leading-none" style={{ fontFamily: "var(--letra-titular)" }}>
            {u.unitLabel}
          </span>
          <span className="mt-1 block text-[12px] leading-snug text-[var(--tenue)]">
            {dondeVa(u)}
            {u.velocidadKmh !== null && (
              <>
                {" · "}
                <span data-medida>{u.velocidadKmh.toFixed(1)} km/h</span>
              </>
            )}
          </span>
        </span>
        <span className="ml-auto text-right">
          <span data-medida className={`block text-[12.5px] ${u.medida?.fresco ? "" : "text-[var(--tenue)]"}`}>
            {edad}
          </span>
          <span
            className={`mt-1.5 block text-[10px] uppercase tracking-[0.14em] ${
              pide ? "font-semibold text-[var(--tinta)]" : "text-[var(--tenue)]"
            }`}
          >
            {palabraDeLaPromesa(u.promesa)}
          </span>
        </span>
      </span>
      {(u.promesa.referencia || vacio) && (
        <Instrumento referencia={u.promesa.referencia} intervalo={u.promesa.intervalo} vacio={vacio ?? undefined} />
      )}
      {u.promesa.intervalo && u.promesa.referencia && (
        <span data-medida className="mt-1 block text-[11px] text-[var(--tenue)]">
          {textoDelIntervalo(u.promesa.intervalo)} · {textoDeReferencia(u.promesa.referencia)}
        </span>
      )}
    </button>
  );
}

/** El corredor vertical del celular: una columna, un sentido, nada compite. */
function CarrilVertical({
  abscisas,
  unidades,
  esperas,
  edadDe,
  seleccion,
  alTocar,
}: {
  abscisas: AbscisaDeParada[];
  unidades: UnidadEnLaTorre[];
  esperas: Torre["esperas"];
  edadDe: (u: UnidadEnLaTorre) => string;
  seleccion: string | null;
  alTocar: (id: string) => void;
}) {
  const esperaDe = new Map(esperas.map((e) => [e.stopId, e]));
  return (
    <ol className="relative ml-1 border-l-2 border-[var(--linea)] pl-6">
      {abscisas.map((p, i) => {
        const espera = esperaDe.get(p.stopId);
        const vencida = espera?.estado === "atrasada";
        const aqui = unidades.filter((u) => {
          if (!u.sobreElCorredor) return false;
          const sig = abscisas[i + 1];
          return (
            u.sobreElCorredor.avanceMetros >= p.avanceMetros &&
            (!sig || u.sobreElCorredor.avanceMetros < sig.avanceMetros)
          );
        });
        return (
          <li key={p.stopId} className="relative pb-6">
            <span
              className={`absolute -left-[26px] top-2 h-0.5 w-3.5 ${vencida ? "bg-[var(--tinta)]" : "bg-[var(--tenue)]"}`}
            />
            <button
              type="button"
              onClick={() => alTocar(`parada:${p.stopId}:${esperas[0]?.sentido ?? "ida"}`)}
              className="flex w-full cursor-pointer items-baseline gap-2 border-0 bg-transparent text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
            >
              <span className={`text-[12px] ${vencida ? "font-semibold text-[var(--tinta)]" : "text-[var(--tenue)]"}`}>
                {p.nombre}
              </span>
              {espera && (
                <span
                  data-medida
                  className={`ml-auto text-[12px] ${vencida ? "text-[var(--senal)]" : "text-[var(--tenue)]"}`}
                >
                  {textoDeEspera(espera)}
                </span>
              )}
            </button>
            {aqui.map((u) => (
              <button
                key={u.unitId}
                type="button"
                onClick={() => alTocar(`unidad:${u.unitId}`)}
                aria-pressed={seleccion === `unidad:${u.unitId}`}
                className="mt-2 flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
              >
                <span className={seleccion === `unidad:${u.unitId}` ? "rounded-lg ring-2 ring-[var(--tinta)]" : ""}>
                  <Glifo estado={glifoDeLaUnidad(u)} rumbo={u.rumboGrados ?? 0} tamano={20} />
                </span>
                <span className="text-[12px] font-bold" style={{ fontFamily: "var(--letra-titular)" }}>
                  {u.unitLabel}
                </span>
                <span data-medida className="text-[10.5px] text-[var(--tenue)]">
                  {edadDe(u)}
                </span>
              </button>
            ))}
          </li>
        );
      })}
    </ol>
  );
}

/** Qué enseña el detalle según lo que se tocó. Sin selección, no hay panel. */
function armarDetalle(seleccion: string | null, torre: Torre, vista: VistaDeLaTorre) {
  if (!seleccion) return null;
  const [tipo, id, sentido] = seleccion.split(":");

  if (tipo === "unidad") {
    const u = torre.unidades.find((x) => x.unitId === id);
    if (!u) return null;
    return {
      titulo: u.unitLabel,
      apoyo: [
        dondeVa(u),
        u.velocidadKmh !== null ? `${u.velocidadKmh.toFixed(1)} km/h` : null,
        // Sin posición, `dondeVa` ya lo dijo: no se repite.
        u.ultimaPosicion ? `dato de ${edad(u.ultimaPosicion.antiguedadSeg)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      ficha: `/casa/transportista/expedientes/unidad/${u.unitId}`,
      fichaTexto: `Ver ${u.unitLabel}`,
      sub: "intervalo contra el paso anterior por esa parada, sea de la unidad que sea: lo que la promesa promete es la frecuencia de paso",
      pasos: u.ultimosPasos,
      nota:
        u.ultimosPasos.length === 0
          ? "Todavía no cruza ninguna parada con el detector corriendo. Nada se afirma de lo que no se midió."
          : "El paso se guarda como rango de hora: los dos pings que lo encierran. Nadie lo captura a mano.",
    };
  }

  if (tipo === "parada") {
    const espera = torre.esperas.find((e) => e.stopId === id && e.sentido === sentido);
    const parada = vista.paradas.find((p) => p.stopId === id);
    if (!espera || !parada) return null;
    return {
      titulo: `${parada.nombre} · ${espera.sentido}`,
      apoyo:
        espera.minutos === null
          ? "sin espera que medir ahora"
          : `${espera.desdeLaApertura ? "sin que pase nadie desde la apertura" : "la espera corre"} · ${textoDeEspera(espera)}${
              espera.referencia ? ` · ${textoDeReferencia(espera.referencia)} min` : ""
            }`,
      sub: "quién pasó, cuándo, y con qué intervalo",
      pasos: espera.ultimasPasadas,
      nota:
        espera.ultimasPasadas.length === 0
          ? "Hoy no ha pasado nadie por aquí. La espera se mide desde que abrió el circuito."
          : undefined,
    };
  }
  return null;
}
