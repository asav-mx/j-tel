import { notFound } from "next/navigation";
import {
  PALABRA_DEL_EXCUSABLE,
  horaConSegundos,
  horaCorta,
  localDateIso,
  veredictoEnPalabras,
} from "@jtel/domain";
import { cargarActa, type ActaDeOcurrencia, type HechoDeLaLinea } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Glifo } from "@/components/casa/glifo";
import { Familia, Renglon, SinCuenta, Titular, Vacio } from "@/components/casa/expediente";
import { TrazaDelActaEnMapa } from "@/components/casa/traza-del-acta";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { GLIFO_DEL_VEREDICTO, fechaCorta, fechaLarga, rutaDelCuarto } from "@/lib/casa/servicios-especiales";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cómo se dice el estado de una aportación. `resuelta` NO es «aceptada»: la planta contestó. */
const ESTADO_DE_APORTACION: Record<string, string> = {
  enviada: "enviada",
  vista: "vista por la planta",
  resuelta: "la planta respondió",
  retirada: "retirada",
};

/**
 * El acta — `Ver ‹ruta› · ‹turno› · ‹fecha›` (ficha Vernier §3).
 *
 * Cuatro familias, en este orden: veredicto, identidad, evidencia,
 * justificación. **Lee lo sellado; jamás recalcula al abrirse** (Marco 1.C:
 * «las pantallas sólo leen el hecho ya guardado»). El cargador no importa el
 * motor, y su prueba lo vigila con un repositorio espía.
 *
 * Lo que el sello no trae se declara, no se deduce: un motivo que el ledger no
 * dejó emparejado dice «Motivo no registrado en este sello»; sin unidad
 * observada no hay traza; esperado y observado van en renglones distintos
 * (Pieza 1.C: nunca se mezclan).
 */
export default async function VerOcurrencia({
  params,
  searchParams,
}: {
  params: Promise<{ ocurrenciaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("acta-de-ocurrencia");
  const cuenta = await cuentaDelCuarto(searchParams);
  reloj.marca("guardia");
  if (!cuenta.carrier) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  if (!cuenta.alcance.conContrato) notFound();

  const { carrier, cuentaEnRuta } = cuenta;
  const { ocurrenciaId } = await params;
  if (!UUID.test(ocurrenciaId)) notFound();

  // Una ocurrencia de otra cuenta no existe desde aquí: `null`, y 404.
  const acta = await cargarActa(getRepos(), { carrierAccountId: carrier.id, ocurrenciaId });
  reloj.marca("datos");
  if (acta) {
    reloj.dato("puntosDeTraza", acta.traza.tipo === "con_puntos" ? acta.traza.tramos.reduce((n, t) => n + t.length, 0) : 0);
  }
  reloj.fin();
  if (!acta) notFound();

  const titulo = `Ver ${acta.identidad.ruta} · ${acta.identidad.turno} · ${fechaCorta(acta.fecha)}`;

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={[{ nombre: "Servicios especiales", ruta: rutaDelCuarto(cuentaEnRuta) }, { nombre: titulo }]} />
        <Titular nombre={titulo} bajo={`${acta.identidad.contrato} · ${carrier.name}`} />

        <FamiliaVeredicto acta={acta} />
        <FamiliaIdentidad acta={acta} />
        <FamiliaEvidencia acta={acta} />
        <FamiliaJustificacion acta={acta} />
      </div>
    </Marco>
  );
}

/* ─── Veredicto ─────────────────────────────────────────────────────────── */

function FamiliaVeredicto({ acta }: { acta: ActaDeOcurrencia }) {
  const { zona } = acta;
  const sello = new Date(acta.selladoAt);
  const resellado = acta.resellos.length > 0;
  const noCumplido = acta.veredicto === "no_cumplido";
  const diaDelSello = fechaCorta(localDateIso(sello, zona)).toUpperCase();

  return (
    <Familia nombre="Veredicto">
      <div className="flex items-center gap-4 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] p-[18px]">
        <span className="flex-none">
          <Glifo estado={GLIFO_DEL_VEREDICTO[acta.veredicto]} tamano={34} />
        </span>
        <div className="min-w-0">
          <p
            className={`text-[20px] leading-tight${noCumplido ? " text-[var(--ladrillo)]" : ""}`}
            style={{ fontFamily: "var(--letra-titular)", fontWeight: 800, letterSpacing: "-0.01em" }}
          >
            {veredictoEnPalabras(acta.veredicto, acta.timing)}
          </p>
          <p data-medida className="mt-1 text-[12px] text-[var(--tenue)]">
            {resellado ? "RE-SELLADO" : "SELLADO"} {diaDelSello} · {horaConSegundos(sello, zona)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3 text-[14px] leading-relaxed">
        <p>{acta.motivo.largo}</p>
        {acta.motivo.cifras.map((c) => (
          <p key={c.medido} data-medida className="mt-1.5 text-[13px]">
            {c.medido} · <span className="text-[var(--tenue)]">{c.umbral}</span>
          </p>
        ))}
        {acta.motivo.nota && <p className="mt-1.5 text-[13px] text-[var(--tenue)]">{acta.motivo.nota}</p>}
      </div>

      {/* La leyenda del hecho congelado es verdad sólo si nunca se re-selló
          (decisión 10 de Asav, 18 sep 2026): un re-sello reemplazó el hecho, y
          decir «se calculó una vez» sería falso. */}
      <p data-medida className="px-0.5 text-[11px] tracking-[0.04em] text-[var(--tenue)]">
        {resellado
          ? "EL SELLO ANTERIOR QUEDA EN LA HISTORIA"
          : "HECHO CONGELADO · SE CALCULÓ UNA VEZ Y NO SE RECALCULA"}
      </p>
    </Familia>
  );
}

/* ─── Identidad ─────────────────────────────────────────────────────────── */

function FamiliaIdentidad({ acta }: { acta: ActaDeOcurrencia }) {
  const i = acta.identidad;
  const ventana = i.ventana.hasta === null ? `${i.ventana.desde} · tolerancia no registrada en el sello` : `${i.ventana.desde}–${i.ventana.hasta}`;
  return (
    <Familia nombre="Identidad">
      {/* Un perfil se repite todos los días; una ocurrencia pasa una vez: por
          eso perfil y fecha van en renglones aparte. */}
      <Renglon pregunta="Perfil de servicio">
        {i.perfil.nombre} <span data-medida className="text-[12.5px] text-[var(--tenue)]">· {i.perfil.codigo}</span>
      </Renglon>
      <Renglon pregunta="Ruta">{i.ruta}</Renglon>
      <Renglon pregunta="Turno" medida>
        {i.turno} · {ventana}
      </Renglon>
      <Renglon pregunta="Fecha">{fechaLarga(acta.fecha)}</Renglon>
      <Renglon pregunta="Contrato">{i.contrato}</Renglon>
      {/* Esperado y observado nunca se mezclan (Pieza 1.C): dos renglones. Las
          posibles son las del perfil HOY: no se congelan con el hecho. */}
      <Renglon pregunta="Unidades posibles · según el perfil hoy" medida={i.unidadesPosibles.length > 0} tenue={i.unidadesPosibles.length === 0}>
        {i.unidadesPosibles.length > 0 ? i.unidadesPosibles.join(" · ") : "El perfil no tiene unidades posibles"}
      </Renglon>
      <Renglon pregunta="Unidad observada" medida={i.unidadObservada !== null} tenue={i.unidadObservada === null}>
        {i.unidadObservada ?? "Ninguna: la evidencia no mostró una unidad para esta ocurrencia"}
      </Renglon>
    </Familia>
  );
}

/* ─── Evidencia ─────────────────────────────────────────────────────────── */

function renglonDeHecho(h: HechoDeLaLinea, zona: string): { hora: string; texto: string; hueco: boolean } {
  switch (h.tipo) {
    case "primer_punto":
      return { hora: horaConSegundos(new Date(h.at), zona), texto: "Primer punto medido del viaje", hueco: false };
    case "hueco":
      return {
        hora: `${horaCorta(new Date(h.desde), zona)}–${horaCorta(new Date(h.hasta), zona)}`,
        texto: `Sin datos · ${h.minutos} min`,
        hueco: true,
      };
    case "salto":
      return {
        hora: `${horaCorta(new Date(h.desde), zona)}–${horaCorta(new Date(h.hasta), zona)}`,
        texto: `Salto del GPS · ${h.km.toFixed(1)} km · la línea entre los dos puntos no se dibuja`,
        hueco: false,
      };
    case "entrada_destino":
      return {
        hora: horaConSegundos(new Date(h.at), zona),
        texto: "Entrada a la geocerca de destino · la traza se corta aquí",
        hueco: false,
      };
  }
}

function FamiliaEvidencia({ acta }: { acta: ActaDeOcurrencia }) {
  const t = acta.traza;
  return (
    <Familia nombre="Evidencia">
      {t.tipo === "sin_unidad_observada" && <Vacio>Ninguna traza es de esta ocurrencia: no hubo unidad observada.</Vacio>}
      {t.tipo === "sin_puntos" && <Vacio>El viaje no guardó puntos de la unidad {t.unidad}.</Vacio>}
      {t.tipo === "con_puntos" && (
        <>
          <TrazaDelActaEnMapa traza={t} clave={acta.id} />
          <p className="px-0.5 text-[12px] text-[var(--tenue)]">
            La traza de la unidad {t.unidad}: rota donde no hubo datos, partida en los saltos
            {t.cortadaEnLaLlegada
              ? ", y cortada al entrar a la geocerca de destino."
              : ". El sello no guarda la hora de llegada, así que no hay dónde cortarla."}
          </p>
          <div className="flex flex-col gap-1.5">
            {t.hechos.map((h, i) => {
              const r = renglonDeHecho(h, acta.zona);
              return (
                <div
                  key={`${h.tipo}-${i}`}
                  className={`flex items-baseline gap-3.5 rounded-lg border bg-[var(--pieza)] px-4 py-2.5 text-[13.5px] ${
                    r.hueco ? "border-dashed border-[var(--linea)] text-[var(--tenue)]" : "border-[var(--linea)]"
                  }`}
                >
                  <span data-medida className="w-[112px] flex-none text-[12.5px]">
                    {r.hora}
                  </span>
                  <span>{r.texto}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Familia>
  );
}

/* ─── Justificación ─────────────────────────────────────────────────────── */

/**
 * Lee `carrier_aportaciones`: decir «sin justificación presentada» a ciegas
 * sería afirmar lo que no se comprobó (decisión 8 de Asav). Con filas, se
 * listan en sólo lectura; el flujo de justificaciones es otra ficha (§D).
 */
function FamiliaJustificacion({ acta }: { acta: ActaDeOcurrencia }) {
  return (
    <Familia nombre="Justificación">
      {acta.aportaciones.length === 0 ? (
        <Renglon pregunta="Justificación" tenue>
          Sin justificación presentada
        </Renglon>
      ) : (
        acta.aportaciones.map((a) => (
          <div key={a.id} className="rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3 text-[14px]">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ fontFamily: "var(--letra-titular)", fontWeight: 700 }}>
                {a.motivo ? (PALABRA_DEL_EXCUSABLE[a.motivo] ?? a.motivo) : "Sin motivo del catálogo"}
              </span>
              <span data-medida className="flex-none text-[12px] text-[var(--tenue)]">
                {fechaCorta(localDateIso(new Date(a.creadaAt), acta.zona))} · {ESTADO_DE_APORTACION[a.estado] ?? a.estado}
              </span>
            </div>
            {a.nota && <p className="mt-1.5 text-[13.5px] text-[var(--tenue)]">{a.nota}</p>}
          </div>
        ))
      )}
    </Familia>
  );
}
