import Link from "next/link";
import { cuartoDeLectores, GRUPOS_DE_LECTOR } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Pieza } from "@/components/casa/pieza";
import { AvisoDeError, Encabezado, Titular, Vacio } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { PanelDeAlta } from "@/components/casa/paneles-de-lector";
import { ROTULO_DE_GRUPO, apoyoDe, datoDe, glifoDe, rutasDeLectores } from "@/lib/casa/lectores";

export const dynamic = "force-dynamic";

/**
 * **Lectores** — el inventario de los lectores de boletos de toda la
 * plataforma (Ontoy 3.0 · P3.5, ratificado por ASAV el 23-sep-2026).
 *
 * ## Una sola lista, sin partir por cuenta
 *
 * La pregunta de esta casa es «¿está sana la plataforma?», y partir la lista
 * por transportista escondería justo al lector que dejó de hablar. Cada pieza
 * dice de quién es. Es lo contrario de Dispositivos, que vive en la casa del
 * transportista porque ahí la pregunta es de su flota.
 *
 * ## Aquí sólo se da de alta
 *
 * Asignar, soltar y dar de baja se hacen en **Ver ‹lector›**, tocando la pieza:
 * una acción se ejecuta en el expediente de su sustantivo (Ley de Acción). Es
 * el mismo reparto que el cajón de Dispositivos.
 *
 * ## Los grupos no se enciman, y MUDO gana
 *
 * Un lector montado y callado se lee como **mudo**, no como «en unidad»: es el
 * que pide ir a ver el camión. Mudo se cuenta en **horas de servicio del
 * circuito**, no de reloj (`HORAS_DE_SERVICIO_PARA_MUDO`, 4 h): un camión
 * dormido en el patio no está mudo, está apagado. Y un lector cuya unidad no
 * tiene circuito **no se juzga** — su pieza lo dice.
 */
export default async function LectoresJStaff({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const sp = await searchParams;
  const uno = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const repos = getRepos();
  const ahora = new Date();
  const cuarto = await cuartoDeLectores(repos, ahora);
  const carriers = await repos.accounts.listByType("carrier");
  const altaAbierta = uno("accion") === "alta";

  /*
   * El «hecho» se arma con lo que hay en la base, no con lo que diga la
   * dirección: si el lector no existe, no se dice nada.
   */
  const recienDado =
    uno("hecho") === "alta" && uno("lector")
      ? (Object.values(cuarto.grupos)
          .flat()
          .find((l) => l.id === uno("lector")) ?? null)
      : null;

  const mudos = cuarto.grupos.mudo.length;
  const deBaja = cuarto.grupos.de_baja.length;

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA} lugar="/casa/jstaff/lectores">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Titular
            nombre="Lectores"
            bajo={[
              `${cuarto.enServicio} en servicio`,
              mudos > 0 ? `${mudos} ${mudos === 1 ? "mudo" : "mudos"}` : null,
              deBaja > 0 ? `${deBaja} de baja` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <Link
            href={altaAbierta ? rutasDeLectores.cuarto() : rutasDeLectores.cuarto({ accion: "alta" })}
            className={clases.abridor(altaAbierta)}
          >
            Dar de alta un lector
          </Link>
        </div>

        {uno("error") && <AvisoDeError mensaje={uno("error")!} />}

        {recienDado && (
          <p className={clases.aviso}>
            <b>{recienDado.nombre}</b> dado de alta ·{" "}
            <span data-medida>{recienDado.huella}</span>
            {recienDado.unidad ? ` · en la ${recienDado.unidad}` : " · en bodega"}. El aparato se
            entera de su nombre solo en cuanto tenga señal.
          </p>
        )}

        {altaAbierta && (
          <PanelDeAlta
            carriers={carriers.map((c) => ({ id: c.id, nombre: c.name }))}
            llave={uno("llave") ?? ""}
            cancelar={rutasDeLectores.cuarto()}
          />
        )}

        {cuarto.total === 0 ? (
          <Vacio>Todavía no hay lectores dados de alta</Vacio>
        ) : (
          GRUPOS_DE_LECTOR.map((grupo) => {
            const lectores = cuarto.grupos[grupo];
            if (lectores.length === 0) return null;
            return (
              <section key={grupo} className="flex flex-col gap-2">
                <Encabezado izquierda={ROTULO_DE_GRUPO[grupo]} derecha={String(lectores.length)} />
                <div className="flex flex-col gap-2.5">
                  {lectores.map((lector) => {
                    const d = datoDe(lector, grupo, ahora);
                    return (
                      <Pieza
                        key={lector.id}
                        estado={glifoDe(grupo)}
                        nombre={lector.nombre}
                        apoyo={apoyoDe(lector)}
                        dato={d.dato}
                        etiqueta={d.etiqueta}
                        edad={d.edad}
                        datoVivo={d.vivo}
                        apagada={grupo === "de_baja" || grupo === "en_bodega"}
                        apoyoQueEnvuelve
                        ficha={rutasDeLectores.ver(lector.id)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <p className={clases.nota}>
          Un lector <b>mudo</b> lleva {4} h de servicio de su circuito sin entregar nada. Uno cuya
          unidad no tiene circuito asignado no se puede juzgar, y no se juzga: su ficha lo dice.
        </p>
      </div>
    </Marco>
  );
}
