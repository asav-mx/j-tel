import Link from "next/link";
import { notFound } from "next/navigation";
import { JTTEL_TZ, lineaDePausa, localDateIso, periodoDePausaEnPalabras } from "@jtel/domain";
import { estadoDeVerificacion, vistaPreviaDePausa } from "@jtel/services";
import { puedePausarVerificacion } from "@jtel/auth-rbac";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { AvisoDeError, Familia, Renglon, Titular } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { correosDeAutores } from "@/lib/casa/autores";
import { ESTADO_COMERCIAL, rutasDeContratos } from "@/lib/casa/contratos";
import { textoDeRuta } from "@/lib/casa/dispositivos";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const titular = { fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.02em" } as const;

/**
 * Ver ‹contrato› — J-Staff (0041, 19 sep 2026).
 *
 * Donde se pausa y se reanuda la verificación de un contrato: la acción vive
 * en la ficha de su sustantivo. Tres momentos, con `?accion=`:
 *
 * - **ver**: quién es, su estado de verificación y la historia de sus eventos.
 * - **pausar**: desde qué fecha y por qué.
 * - **revisar**: antes de escribir nada, qué va a pasar — cuántas ocurrencias sin
 *   hecho se borran, cuántos hechos no se tocan, cuántos pendientes se congelan.
 *   Nada se escribe hasta «Pausar la verificación».
 *
 * Reanudar es un solo paso con confirmación: vale desde ahora y no pide motivo
 * (decisión 6 de Asav).
 *
 * Los botones los ve sólo el admin de plataforma (decisión 8, provisional hasta
 * la 6.29). La ruta vuelve a preguntar: esconder un botón no es una guardia.
 */
export default async function VerContrato({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identidad = await exigirEnPagina({ tipo: "jstaff" });
  const { contractId } = await params;
  if (!UUID.test(contractId)) notFound();
  const sp = await searchParams;
  const repos = getRepos();
  const contrato = await repos.pausas.contrato(contractId);
  if (!contrato) notFound();

  const ahora = new Date();
  const zona = contrato.zona ?? JTTEL_TZ;
  const actua = puedePausarVerificacion(identidad.memberships);
  const { intervalos, vigente } = await estadoDeVerificacion(repos, contractId, ahora);

  const pedida = typeof sp.accion === "string" ? sp.accion : null;
  let accion = actua && (pedida === "pausar" || pedida === "revisar" || pedida === "reanudar") ? pedida : null;
  if (accion === "reanudar" && !vigente) accion = null;
  if ((accion === "pausar" || accion === "revisar") && vigente) accion = null;
  let error = textoDeRuta(sp.error);
  const campos = { fecha: textoDeRuta(sp.fecha, 10) ?? "", motivo: textoDeRuta(sp.motivo, 400) ?? "" };

  // Revisar sólo lo que pasaría la regla; si no pasa, se vuelve a pausar con el aviso.
  const previa =
    accion === "revisar"
      ? await vistaPreviaDePausa(repos, { contractId, fechaIso: campos.fecha, motivo: campos.motivo, zona, ahora })
      : null;
  if (previa && !previa.ok) {
    accion = "pausar";
    error = previa.mensaje;
  }

  const historia = accion ? [] : await repos.pausas.historiaDe(contractId);
  const autores = await correosDeAutores(historia.map((h) => h.actorId));
  const ficha = rutasDeContratos.contrato(contractId);
  const pasos = [
    { nombre: "Contratos", ruta: rutasDeContratos.lista() },
    { nombre: contrato.nombre, ruta: accion ? ficha : undefined },
    ...(accion ? [{ nombre: accion === "reanudar" ? "Reanudar" : accion === "pausar" ? "Pausar" : "Revisar" }] : []),
  ];

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={pasos} />
        <Titular nombre={contrato.nombre} bajo={[contrato.transportista, contrato.cliente, contrato.planta].filter(Boolean).join(" · ")} />

        {!accion && error && <AvisoDeError mensaje={error} />}

        {accion === "pausar" && <FormularioDePausa contractId={contractId} campos={campos} error={error} hoy={localDateIso(ahora, zona)} />}

        {accion === "revisar" && previa?.ok && (
          <RevisionDePausa
            contractId={contractId}
            campos={campos}
            linea={lineaDePausa({ desde: previa.valeDesde, hasta: null, motivo: previa.motivo }, { zona })}
            efecto={previa.efecto}
          />
        )}

        {accion === "reanudar" && vigente && (
          <form method="post" action="/api/casa/jstaff/contratos/reanudacion" className={clases.panel}>
            <input type="hidden" name="contractId" value={contractId} />
            <p className="text-[18px]" style={titular}>
              ¿Reanudar la verificación?
            </p>
            <p className="text-[14px]">
              Vale desde ahora. Lo que cayó en la pausa ({periodoDePausaEnPalabras(vigente, zona)} a hoy) queda sin generar: no se
              inventa hacia atrás. Los pendientes de antes de la pausa vuelven a la cola del motor solos.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button type="submit" className={clases.primario}>
                Reanudar la verificación
              </button>
              <Link href={ficha} className={clases.secundario}>
                Cancelar
              </Link>
            </div>
          </form>
        )}

        {!accion && (
          <>
            <Familia nombre="La verificación">
              <div className="rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3.5">
                <p className="text-[18px] leading-tight" style={titular}>
                  {vigente ? "En pausa" : "Verificando"}
                </p>
                <p className="mt-1 text-[13.5px] text-[var(--tenue)]">
                  {vigente
                    ? lineaDePausa(vigente, { zona })
                    : intervalos.length > 0
                      ? "El motor genera y sella las ocurrencias de este contrato."
                      : "El motor genera y sella las ocurrencias de este contrato. Nunca se ha pausado."}
                </p>
              </div>
              {actua && (
                <div>
                  <Link href={rutasDeContratos.accion(contractId, vigente ? "reanudar" : "pausar")} className={clases.secundario}>
                    {vigente ? "Reanudar la verificación" : "Pausar la verificación"}
                  </Link>
                </div>
              )}
            </Familia>

            <Familia nombre="Historia de la verificación">
              {historia.length === 0 ? (
                <Renglon pregunta="Eventos" tenue>
                  Sin pausas ni reanudaciones
                </Renglon>
              ) : (
                <ol className="flex flex-col rounded-lg border border-[var(--linea)] bg-[var(--pieza)]">
                  {[...historia].reverse().map((h) => (
                    <li key={h.id} className="flex flex-col gap-1 border-t border-[var(--linea)] px-4 py-2.5 first:border-t-0">
                      <span className="text-[14px]">
                        {h.tipo === "pausa" ? "Pausa" : "Reanudación"} · vale desde el{" "}
                        <span data-medida>{localDateIso(h.valeDesde, zona)}</span>
                      </span>
                      {h.motivo && <span className="text-[13px] text-[var(--tenue)]">«{h.motivo}»</span>}
                      <span data-medida className="text-[12px] text-[var(--tenue)]">
                        registrado el {localDateIso(h.registradoAt, zona)} · {h.actorId ? (autores.get(h.actorId) ?? h.actorId) : "sin autor"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Familia>

            <Familia nombre="Identidad">
              <Renglon pregunta="Transportista">{contrato.transportista}</Renglon>
              <Renglon pregunta="Cliente">{contrato.cliente}</Renglon>
              {contrato.planta && <Renglon pregunta="Planta">{contrato.planta}</Renglon>}
              <Renglon pregunta="Vigencia" medida>
                {contrato.vigenteDesde} → {contrato.vigenteHasta}
              </Renglon>
              {/* Decisión 9 de Asav: la etiqueta vieja no se muestra junto a la
                  pausa sin distinguirla. Es comercial, y no detiene nada. */}
              <Renglon pregunta="Estado comercial">
                {ESTADO_COMERCIAL[contrato.estadoComercial] ?? contrato.estadoComercial}
                <span className="block text-[12px] text-[var(--tenue)]">etiqueta comercial · no pausa la verificación</span>
              </Renglon>
            </Familia>
          </>
        )}
      </div>
    </Marco>
  );
}

function FormularioDePausa({
  contractId,
  campos,
  error,
  hoy,
}: {
  contractId: string;
  campos: { fecha: string; motivo: string };
  error: string | null;
  hoy: string;
}) {
  return (
    // GET a la misma ficha: revisar no escribe nada. Pausar es otro paso.
    <form method="get" action={rutasDeContratos.contrato(contractId)} className={clases.panel}>
      <input type="hidden" name="accion" value="revisar" />
      <p className="text-[14px]">
        Mientras dure la pausa, el motor no genera ocurrencias de este contrato ni sella nada de él. Lo ya sellado no se toca.
      </p>
      {error && <AvisoDeError mensaje={error} />}
      <label htmlFor="fecha" className="flex flex-col gap-1.5 text-[13px]">
        Vale desde
        <input id="fecha" name="fecha" type="date" required max={hoy} defaultValue={campos.fecha} data-medida className={clases.campo} />
        <span className={clases.ayuda}>El día que empezó de verdad; puede ser antes de hoy. No se agenda hacia el futuro.</span>
      </label>
      <label htmlFor="motivo" className="flex flex-col gap-1.5 text-[13px]">
        Motivo
        <input id="motivo" name="motivo" required maxLength={160} defaultValue={campos.motivo} className={clases.campo} />
        <span className={clases.ayuda}>Corto: es la línea que verá el transportista arriba de sus servicios.</span>
      </label>
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className={clases.primario}>
          Revisar qué pasa
        </button>
        <Link href={rutasDeContratos.contrato(contractId)} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function RevisionDePausa({
  contractId,
  campos,
  linea,
  efecto,
}: {
  contractId: string;
  campos: { fecha: string; motivo: string };
  linea: string;
  efecto: { seBorran: number; seQuedanSinSellar: number; selladosNoSeTocan: number; pendientesSeCongelan: number; entradasDelLedgerSeVan: number };
}) {
  const n = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
  return (
    <>
      <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] p-5">
        <p className="text-[22px] leading-tight" style={titular}>
          {efecto.seBorran === 0 ? "No se borra ninguna ocurrencia" : `Se ${efecto.seBorran === 1 ? "borra" : "borran"} ${n(efecto.seBorran, "ocurrencia sin hecho", "ocurrencias sin hecho")}`}
        </p>
        <p className="text-[13.5px] text-[var(--tenue)]">Lo que verá el transportista: «{linea}»</p>
      </div>

      <Familia nombre="Qué pasa">
        <Renglon pregunta="Ocurrencias sin hecho que se borran" medida>
          {efecto.seBorran}
        </Renglon>
        {efecto.entradasDelLedgerSeVan > 0 && (
          <Renglon pregunta="Entradas de bitácora de esos intentos, que se van con ellas" medida>
            {efecto.entradasDelLedgerSeVan}
          </Renglon>
        )}
        {efecto.seQuedanSinSellar > 0 && (
          <Renglon pregunta="Sin hecho pero con historia: se quedan y no se sellan" medida>
            {efecto.seQuedanSinSellar}
          </Renglon>
        )}
        <Renglon pregunta="Hechos sellados dentro de la pausa: no se tocan" medida>
          {efecto.selladosNoSeTocan}
        </Renglon>
        <Renglon pregunta="Pendientes de antes que se congelan mientras dure" medida>
          {efecto.pendientesSeCongelan}
        </Renglon>
      </Familia>

      <form method="post" action="/api/casa/jstaff/contratos/pausa" className="flex flex-wrap gap-2.5">
        <input type="hidden" name="contractId" value={contractId} />
        <input type="hidden" name="fecha" value={campos.fecha} />
        <input type="hidden" name="motivo" value={campos.motivo} />
        <button type="submit" className={clases.primario}>
          Pausar la verificación
        </button>
        <Link href={rutasDeContratos.accion(contractId, "pausar", campos)} className={clases.secundario}>
          Cambiar
        </Link>
      </form>
    </>
  );
}
