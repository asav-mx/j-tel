import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarExpedienteDeUnidad, type FojaLeida } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Glifo } from "@/components/casa/glifo";
import { AvisoDeError, Familia, Renglon, SinCuenta, Titular, Vacio } from "@/components/casa/expediente";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { correosDeAutores } from "@/lib/casa/autores";
import { LARGO_FOLIO, LARGO_NOTA, type AccionDePapel } from "@/lib/casa/captura";
import {
  diaDe,
  fechaCorta,
  glifoDePapel,
  rutas,
  titularDePapel,
  umbralDePapel,
} from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

const titular = { fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.02em" } as const;
const boton =
  "inline-flex cursor-pointer items-center rounded-lg border px-4 py-2.5 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]";
const primario = `${boton} border-[var(--tinta)] bg-[var(--tinta)] text-[var(--papel)]`;
const secundario = `${boton} border-[var(--linea)] text-[var(--tinta)] hover:bg-[var(--roce)]`;
const campo =
  "w-full rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3 py-2.5 text-[14px] text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]";

/**
 * Un papel del expediente de una unidad: donde se decide y donde se actúa.
 *
 * - **El número con su umbral** (skill): cuánto falta, y la fecha con los días de
 *   aviso de su tipo. Un papel sin regla muestra su fecha y dice qué regla falta.
 * - **Las acciones viven aquí** (Ley de Acción): capturar si nunca se capturó;
 *   renovar o corregir si ya hay foja. `?accion=` abre el formulario en la misma
 *   página.
 * - **La historia**: cada versión con su autor (el correo de su sesión) y su
 *   nota; las fojas anteriores, que son las renovaciones.
 * - **«Sin archivo»** hasta que llegue el almacenamiento (PR C).
 */
export default async function VerPapel({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string; tipoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("papel");
  const cuenta = await cuentaDelCuarto(searchParams);
  reloj.marca("guardia");
  if (!cuenta.carrier) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  const { carrier, cuentaEnRuta } = cuenta;
  const { unitId, tipoId } = await params;
  const sp = await searchParams;
  const accion = (["capturar", "renovar", "corregir"] as const).find((a) => a === sp.accion) ?? null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const ahora = new Date();

  const e = await cargarExpedienteDeUnidad(getRepos(), { carrierAccountId: carrier.id, unitId, ahora });
  reloj.marca("datos");
  reloj.fin();
  if (!e || e.documentos.estado !== "con_datos") notFound();
  const docs = e.documentos.valor;
  const papel = docs.papeles.find((p) => p.tipo.id === tipoId);
  if (!papel) notFound();

  const unidad = e.identidad.numeroEconomico.estado === "con_datos" ? e.identidad.numeroEconomico.valor : "Unidad";
  const zona = docs.mercado.zonaHoraria;
  const vigente = papel.vigente;
  const version = vigente?.versiones[0] ?? null;
  const glifo = glifoDePapel(papel.estado.estado);
  const umbral = umbralDePapel(papel.estado, papel.regla?.diasDeAviso ?? null);

  const autores = await correosDeAutores([
    ...(vigente?.versiones.map((v) => v.actorId) ?? []),
    ...papel.anteriores.flatMap((f) => f.versiones.map((v) => v.actorId)),
  ]);
  const quien = (id: string | null) => (id ? (autores.get(id) ?? id) : "sin autor");

  // La acción pedida sólo vale si tiene sentido para este papel.
  const accionValida: AccionDePapel | null =
    accion === "capturar" && !vigente ? "capturar" : accion && accion !== "capturar" && vigente ? accion : null;

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas
          pasos={[
            { nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) },
            { nombre: `Ver ${unidad}`, ruta: rutas.unidad(unitId, cuentaEnRuta) },
            { nombre: papel.tipo.nombre, ruta: accionValida ? rutas.papel(unitId, tipoId, cuentaEnRuta) : undefined },
            ...(accionValida ? [{ nombre: NOMBRE_DE_ACCION[accionValida] }] : []),
          ]}
        />
        <Titular nombre={papel.tipo.nombre} bajo={`${unidad} · catálogo de ${docs.mercado.nombre}`} />

        {accionValida ? (
          <Formulario
            accion={accionValida}
            cuenta={carrier.slug}
            unitId={unitId}
            tipoId={tipoId}
            documentId={accionValida === "corregir" ? (vigente?.id ?? "") : ""}
            valores={
              error
                ? {
                    folio: typeof sp.folio === "string" ? sp.folio : null,
                    emitidoEl: typeof sp.emitidoEl === "string" ? sp.emitidoEl : null,
                    venceEl: typeof sp.venceEl === "string" ? sp.venceEl : null,
                    venceCalculado: false,
                  }
                : accionValida === "corregir"
                  ? version
                  : null
            }
            nota={error && typeof sp.nota === "string" ? sp.nota : ""}
            periodicidad={papel.regla?.vence ? papel.regla.periodicidadMeses : null}
            error={error}
            cancelar={rutas.papel(unitId, tipoId, cuentaEnRuta)}
          />
        ) : (
          <>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] p-5">
              {glifo && <Glifo estado={glifo} tamano={40} />}
              <div>
                <p className="text-[24px] leading-tight" style={titular}>
                  {titularDePapel(papel.estado)}
                </p>
                {umbral && (
                  <p data-medida className="mt-1 text-[13px] text-[var(--tenue)]">
                    {umbral}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {vigente ? (
                <>
                  <Link href={rutas.papel(unitId, tipoId, cuentaEnRuta, "renovar")} className={primario}>
                    Renovar
                  </Link>
                  <Link href={rutas.papel(unitId, tipoId, cuentaEnRuta, "corregir")} className={secundario}>
                    Corregir
                  </Link>
                </>
              ) : (
                <Link href={rutas.papel(unitId, tipoId, cuentaEnRuta, "capturar")} className={primario}>
                  Capturar
                </Link>
              )}
            </div>

            <Familia nombre="Lo que dice el papel">
              {version ? (
                <>
                  <Renglon pregunta="Folio" medida>{version.folio ?? "sin folio"}</Renglon>
                  <Renglon pregunta="Emitido" medida>{version.emitidoEl ? fechaCorta(version.emitidoEl) : "sin fecha"}</Renglon>
                  <Renglon pregunta="Vence" medida>
                    {version.venceEl
                      ? `${fechaCorta(version.venceEl)} · ${version.venceCalculado ? "calculada" : "impresa"}`
                      : "sin fecha"}
                  </Renglon>
                  <Renglon pregunta="Archivo" tenue>Sin archivo · llega con el almacenamiento</Renglon>
                </>
              ) : (
                <Vacio>Todavía no se ha capturado</Vacio>
              )}
            </Familia>

            {vigente && (
              <Familia nombre="Historia de esta foja">
                <Historia foja={vigente} quien={quien} zona={zona} />
              </Familia>
            )}

            {papel.anteriores.length > 0 && (
              <Familia nombre="Fojas anteriores">
                {/* Sin glifo: una foja renovada no está vigente ni pide nada; su
                    estado ya no se juzga. Queda como historia. */}
                {papel.anteriores.map((f) => {
                  const v = f.versiones[0]!;
                  return (
                    <Renglon key={f.id} pregunta={v.venceEl ? `Vencía el ${fechaCorta(v.venceEl)}` : "Sin fecha de vencimiento"} medida>
                      {v.folio ?? "sin folio"} · capturada {diaDe(f.capturadaAt, zona)}
                    </Renglon>
                  );
                })}
              </Familia>
            )}
          </>
        )}
      </div>
    </Marco>
  );
}

const NOMBRE_DE_ACCION: Record<AccionDePapel, string> = {
  capturar: "Capturar",
  renovar: "Renovar",
  corregir: "Corregir",
};

function Historia({ foja, quien, zona }: { foja: FojaLeida; quien: (id: string | null) => string; zona: string }) {
  return (
    <ol className="flex flex-col rounded-lg border border-[var(--linea)] bg-[var(--pieza)]">
      {foja.versiones.map((v, i) => {
        const esLaPrimera = i === foja.versiones.length - 1;
        return (
          <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--linea)] px-4 py-2.5 first:border-t-0">
            <span className="text-[13px]">
              {esLaPrimera ? "Capturada" : "Corregida"}
              {v.nota ? <span className="text-[var(--tenue)]"> · «{v.nota}»</span> : null}
            </span>
            <span data-medida className="text-[12px] text-[var(--tenue)]">
              {diaDe(v.capturadaAt, zona)} · {quien(v.actorId)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Formulario({
  accion,
  cuenta,
  unitId,
  tipoId,
  documentId,
  valores,
  periodicidad,
  error,
  cancelar,
  nota,
}: {
  accion: AccionDePapel;
  cuenta: string;
  unitId: string;
  tipoId: string;
  documentId: string;
  valores: { folio: string | null; emitidoEl: string | null; venceEl: string | null; venceCalculado: boolean } | null;
  periodicidad: number | null;
  error: string | null;
  cancelar: string;
  nota: string;
}) {
  const explica: Record<AccionDePapel, string> = {
    capturar: "Se crea la primera foja de este papel.",
    renovar: "Se crea una foja nueva. La anterior queda en el historial.",
    corregir: "Se agrega una versión nueva de la foja vigente. La anterior queda en su historia.",
  };
  return (
    <form action="/api/casa/expedientes/papel" method="post" className="flex flex-col gap-4">
      <p className="text-[14px] text-[var(--tenue)]">{explica[accion]}</p>
      {error && <AvisoDeError mensaje={error} />}
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value={accion} />
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="tipoId" value={tipoId} />
      <input type="hidden" name="documentId" value={documentId} />

      <label className="flex flex-col gap-1.5 text-[13px]" htmlFor="folio">
        Folio
        <input id="folio" name="folio" maxLength={LARGO_FOLIO} defaultValue={valores?.folio ?? ""} autoComplete="off" data-medida className={campo} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px]" htmlFor="emitidoEl">
          Emitido el
          <input id="emitidoEl" name="emitidoEl" type="date" defaultValue={valores?.emitidoEl ?? ""} data-medida className={campo} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px]" htmlFor="venceEl">
          Vence el
          <input
            id="venceEl"
            name="venceEl"
            type="date"
            // Una fecha calculada no se ofrece como si viniera impresa: si se deja
            // vacía, se vuelve a calcular con la regla vigente.
            defaultValue={valores && !valores.venceCalculado ? (valores.venceEl ?? "") : ""}
            data-medida
            className={campo}
          />
          <span className="text-[12px] text-[var(--tenue)]">
            Como viene impresa.{" "}
            {periodicidad
              ? `Si el papel no la trae, déjala vacía: se calcula ${periodicidad === 12 ? "un año" : `${periodicidad} meses`} desde la emisión.`
              : "Si el papel no la trae, déjala vacía."}
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px]" htmlFor="nota">
        {accion === "corregir" ? "Qué se corrige" : "Nota"}
        <textarea id="nota" name="nota" maxLength={LARGO_NOTA} rows={3} defaultValue={nota} placeholder="Opcional. Queda junto a la versión." className={`${campo} font-[inherit]`} />
      </label>

      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className={primario}>
          {accion === "corregir" ? "Guardar versión" : accion === "renovar" ? "Guardar la foja nueva" : "Guardar"}
        </button>
        <Link href={cancelar} className={secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
