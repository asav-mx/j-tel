import Link from "next/link";
import { notFound } from "next/navigation";
import { cuartoDeLectores } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Glifo } from "@/components/casa/glifo";
import { AvisoDeError, Familia, Renglon, Titular } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { Huella, PanelAsignar, PanelConMotivo } from "@/components/casa/paneles-de-lector";
import { diaDe, edad } from "@/lib/casa/expedientes";
import { apoyoDe, glifoDe, rutasDeLectores, saludEnPalabras } from "@/lib/casa/lectores";
import { grupoDe } from "@jtel/services";

export const dynamic = "force-dynamic";

/**
 * **Ver ‹lector›** — el expediente de un lector, y donde se actúa sobre él.
 *
 * Ley de Acción: una acción se ejecuta en el expediente de su sustantivo. El
 * cajón da de alta; **montar, soltar y dar de baja se hacen aquí**, tocando la
 * pieza. Es el mismo reparto que Ver ‹dispositivo›.
 *
 * ## Lo que esta pantalla puede afirmar, y lo que no
 *
 * El circuito que se muestra es el que el **plan** le asigna a su unidad
 * (`circuit_unit_assignments`), nunca el recorrido: el recorrido se deriva del
 * GPS y no vive en el libro. Y si su unidad no tiene circuito, la salud dice
 * **«no se puede decir»** en vez de inventarle una jornada contra la cual
 * contar su silencio.
 */
export default async function VerLector({
  params,
  searchParams,
}: {
  params: Promise<{ lectorId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const { lectorId } = await params;
  const sp = await searchParams;
  const uno = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const repos = getRepos();
  const ahora = new Date();
  const cuarto = await cuartoDeLectores(repos, ahora);
  const lector = Object.values(cuarto.grupos)
    .flat()
    .find((l) => l.id === lectorId);
  if (!lector) notFound();

  const grupo = grupoDe(lector);
  const lleno = await repos.libroDeBoletos.lectorPorId(lectorId);
  const unidades = lector.bajaEn ? [] : await repos.libroDeBoletos.unidadesAsignables(lector.carrierAccountId);
  const accion = uno("accion");
  const cancelar = rutasDeLectores.ver(lectorId);

  const hechos: Record<string, string> = {
    asignado: "Montado en su unidad.",
    soltado: "Soltado de su unidad.",
    baja: "Dado de baja. Su llave queda revocada desde este momento.",
  };
  const hecho = uno("hecho") ? hechos[uno("hecho")!] : undefined;

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA} lugar="/casa/jstaff/lectores">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Migas pasos={[{ nombre: "Lectores", ruta: rutasDeLectores.cuarto() }, { nombre: lector.nombre }]} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex-none">
              <Glifo estado={glifoDe(grupo)} tamano={28} />
            </span>
            <Titular nombre={`Ver ${lector.nombre}`} bajo={apoyoDe(lector)} />
          </div>
          <div className="text-right">
            <div data-medida className="text-[17px] leading-tight">
              {lector.ultimoContacto ? edad(lector.ultimoContacto, ahora) : "nunca"}
            </div>
            <div data-medida className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--tenue)]">
              {lector.ultimoContacto ? "último contacto" : "no ha entregado nada"}
            </div>
          </div>
        </div>

        {uno("error") && <AvisoDeError mensaje={uno("error")!} />}
        {hecho && <p className={clases.aviso}>{hecho}</p>}

        <Familia nombre="Identidad">
          <Renglon pregunta="Nombre" medida>{lector.nombre}</Renglon>
          <Renglon pregunta="Transportista">{lector.carrier}</Renglon>
          <Renglon pregunta="Alta" medida>
            {lleno
              ? `${diaDe(lleno.altaEn, "America/Ciudad_Juarez")}${lleno.altaPor ? ` · ${lleno.altaPor}` : ""}`
              : "—"}
          </Renglon>
          <div className="flex flex-col gap-1.5 border-t border-[var(--linea)] pt-3">
            <span className="text-[13px] text-[var(--tenue)]">
              Huella de su llave — los últimos seis, para comparar con el aparato
            </span>
            <Huella llave={lector.huella.length === 6 && lleno ? lleno.llavePublica : ""} tamano={26} />
            <span data-medida className="break-all text-[11px] leading-relaxed text-[var(--tenue)]">
              {lleno?.llavePublica}
            </span>
          </div>
        </Familia>

        <Familia nombre="Actividad">
          <Renglon pregunta="Estado">{saludEnPalabras(lector.salud)}</Renglon>
          <Renglon pregunta="Unidad" medida={Boolean(lector.unidad)} tenue={!lector.unidad}>
            {lector.unidad ?? "En bodega, sin unidad"}
          </Renglon>
          <Renglon
            pregunta="Circuito que el plan le asigna"
            tenue={!lector.circuito}
          >
            {lector.unidad ? (lector.circuito ?? "Su unidad no tiene circuito asignado") : "—"}
          </Renglon>
          {lector.bajaEn && (
            <Renglon pregunta="Baja">
              {`${diaDe(lector.bajaEn, "America/Ciudad_Juarez")} · ${lector.bajaMotivo ?? "sin motivo registrado"}`}
            </Renglon>
          )}
        </Familia>

        {lector.bajaEn ? (
          <p className={clases.nota}>
            Este lector está de baja: <b>su llave está revocada</b> y sus entregas se rechazan. La
            fila no se borra — sus viajes en el libro siguen apuntando aquí, y por eso se puede leer
            lo que quemó cuando estaba en servicio.
          </p>
        ) : (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {!lector.unitId && (
                <Link href={rutasDeLectores.ver(lectorId, { accion: "asignar" })} className={clases.abridor(accion === "asignar")}>
                  Montar en una unidad
                </Link>
              )}
              {lector.unitId && (
                <>
                  <Link href={rutasDeLectores.ver(lectorId, { accion: "asignar" })} className={clases.abridor(accion === "asignar")}>
                    Cambiar de unidad
                  </Link>
                  <Link href={rutasDeLectores.ver(lectorId, { accion: "soltar" })} className={clases.abridor(accion === "soltar")}>
                    Soltar de la {lector.unidad}
                  </Link>
                </>
              )}
              <Link href={rutasDeLectores.ver(lectorId, { accion: "baja" })} className={clases.abridor(accion === "baja")}>
                Dar de baja
              </Link>
            </div>

            {accion === "asignar" && (
              <PanelAsignar lectorId={lectorId} unidades={unidades} cancelar={cancelar} />
            )}
            {accion === "soltar" && (
              <PanelConMotivo
                lectorId={lectorId}
                accion="soltar"
                titulo={`Soltar de la ${lector.unidad}`}
                boton="Soltar"
                motivo={uno("motivo") ?? ""}
                cancelar={cancelar}
                nota="El lector queda en bodega y su llave sigue valiendo: lo que tenga sin entregar se entrega igual."
              />
            )}
            {accion === "baja" && (
              <PanelConMotivo
                lectorId={lectorId}
                accion="baja"
                titulo="Dar de baja"
                boton="Dar de baja"
                motivo={uno("motivo") ?? ""}
                cancelar={cancelar}
                nota={
                  <>
                    <b>La baja revoca su llave en el instante.</b> Desde que se guarda, sus lotes se
                    rechazan y el intento queda escrito — que es lo que la hace útil cuando el
                    aparato anda en otras manos. La fila no se borra, y si está montado se suelta en
                    el mismo acto.
                  </>
                }
              />
            )}
          </section>
        )}
      </div>
    </Marco>
  );
}
