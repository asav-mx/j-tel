import Link from "next/link";
import { GRUPOS_DE_DISPOSITIVO, JTTEL_TZ, MODELOS_DE_DISPOSITIVO } from "@jtel/domain";
import { cargarCuartoDeDispositivos, type DispositivoDelInventario } from "@jtel/services";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Pieza } from "@/components/casa/pieza";
import { Glifo } from "@/components/casa/glifo";
import { CampoImei } from "@/components/casa/campo-imei";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";
import { AvisoDeError, Encabezado, Renglon, SinCuenta, Titular } from "@/components/casa/expediente";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { diaDe, edad, glifoDeDispositivo } from "@/lib/casa/expedientes";
import { apoyoDeInventario, rutasDeDispositivos, senalViva, textoDeRuta } from "@/lib/casa/dispositivos";

export const dynamic = "force-dynamic";

/**
 * Dispositivos — el inventario del transportista (Marco 6.6). C4-b del cuarto
 * de Compás; prototipo aprobado el 17 de septiembre de 2026
 * (https://claude.ai/artifact/FGi58hto8teEYappBAQw1Z).
 *
 * Arriba un número por grupo; abajo los dispositivos en el orden del
 * inventario: EN UNIDAD · EN BODEGA · DESCONECTADO, y los de baja plegados al
 * final — su historia queda, pero no ahogan a los que están en servicio.
 *
 * **Aquí sólo se da de alta.** Asignar, soltar y dar de baja se hacen en Ver
 * ‹dispositivo›, tocando el dispositivo: una acción se ejecuta en el expediente
 * de su sustantivo (Ley de Acción).
 *
 * El botón lo ven coordinador y admin (`puedeManejarFlota`). A despacho no se le
 * dibuja ni apagado ni con candado: la regla 4 del mapa. La ruta vuelve a
 * preguntar, porque esconder un botón no es una guardia.
 */
export default async function CuartoDeDispositivos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("dispositivos");
  const cuenta = await cuentaDelCuarto(searchParams);
  reloj.marca("guardia");
  if (!cuenta.carrier) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }

  const { carrier, cuentaEnRuta, identidad } = cuenta;
  const sp = await searchParams;
  const ahora = new Date();
  const cuarto = await cargarCuartoDeDispositivos(getRepos(), { carrierAccountId: carrier.id, ahora });
  reloj.marca("datos");
  reloj.fin();

  const actua = puedeManejarFlota(identidad.memberships, carrier.id);
  const altaAbierta = actua && sp.accion === "alta";
  // El «hecho» se arma con lo que hay en la base, no con lo que diga la
  // dirección: si el dispositivo no es de esta cuenta, no se dice nada.
  const recienDado =
    sp.hecho === "alta" && typeof sp.dispositivo === "string"
      ? cuarto.grupos.en_bodega.find((d) => d.id === sp.dispositivo) ?? null
      : null;

  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Titular
            nombre="Dispositivos"
            bajo={`${carrier.name} · ${cuarto.total === 1 ? "1 dispositivo" : `${cuarto.total} dispositivos`}`}
          />
          {actua &&
            (altaAbierta ? (
              <Link href={rutasDeDispositivos.cuarto(cuentaEnRuta)} className={clases.abridor(true)} aria-expanded="true">
                Dar de alta
              </Link>
            ) : (
              <Link href={rutasDeDispositivos.cuarto(cuentaEnRuta, { accion: "alta" })} className={clases.primario} aria-expanded="false">
                Dar de alta
              </Link>
            ))}
        </div>

        {recienDado && (
          <p role="status" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[14px]">
            <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-[var(--vivo)]" />
            <span>
              Dado de alta: <b data-medida>{recienDado.nombre ?? recienDado.imei}</b>, en bodega.
            </span>
            <Link
              href={rutasDeDispositivos.ver(recienDado.id, cuentaEnRuta, { desde: "dispositivos", accion: "asignar" })}
              className="underline decoration-[var(--linea)] underline-offset-4"
            >
              Asignarlo a una unidad
            </Link>
          </p>
        )}

        {/* Un error que no es del panel —la guardia negó el paso, la cuenta no
            existe— regresa sin `accion`. Si sólo lo dibujara el panel, no se
            vería nunca. */}
        {!altaAbierta && textoDeRuta(sp.error) && <AvisoDeError mensaje={textoDeRuta(sp.error)!} />}

        {altaAbierta && (
          <PanelDeAlta
            cuenta={carrier.slug}
            cancelar={rutasDeDispositivos.cuarto(cuentaEnRuta)}
            imei={textoDeRuta(sp.imei, 40) ?? ""}
            error={textoDeRuta(sp.error)}
          />
        )}

        <Resumen grupos={cuarto.grupos} />

        {(["en_unidad", "en_bodega", "desconectado"] as const).map((g) =>
          cuarto.grupos[g].length === 0 ? null : (
            <section key={g} className="flex flex-col gap-2" aria-label={glifoDeDispositivo({ grupo: g }).palabra}>
              <Encabezado izquierda={`${glifoDeDispositivo({ grupo: g }).palabra} · ${cuarto.grupos[g].length}`} />
              {cuarto.grupos[g].map((d) => (
                <PiezaDeInventario key={d.id} d={d} ahora={ahora} ficha={rutasDeDispositivos.ver(d.id, cuentaEnRuta, { desde: "dispositivos" })} />
              ))}
            </section>
          ),
        )}

        {cuarto.total === 0 && (
          <Renglon pregunta="Dispositivos" tenue>
            Ninguno dado de alta en esta cuenta
          </Renglon>
        )}

        {cuarto.grupos.de_baja.length > 0 && (
          <details className="group flex flex-col">
            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-2.5 opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]">
              <span className="flex items-center gap-2.5 text-[13px] text-[var(--tenue)]">
                <Glifo estado="dispositivo-de-baja" tamano={16} />
                De baja
              </span>
              <span data-medida className="text-[13.5px]">
                {cuarto.grupos.de_baja.length} · <span className="group-open:hidden">ver</span>
                <span className="hidden group-open:inline">ocultar</span>
              </span>
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {cuarto.grupos.de_baja.map((d) => (
                <PiezaDeInventario key={d.id} d={d} ahora={ahora} ficha={rutasDeDispositivos.ver(d.id, cuentaEnRuta, { desde: "dispositivos" })} />
              ))}
            </div>
          </details>
        )}
      </div>
    </Marco>
  );
}

/** Un número por grupo, con su forma. Un grupo en cero se dice en cero, punteado. */
function Resumen({ grupos }: { grupos: Record<(typeof GRUPOS_DE_DISPOSITIVO)[number], DispositivoDelInventario[]> }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumen">
      {GRUPOS_DE_DISPOSITIVO.map((g) => {
        const { glifo, palabra } = glifoDeDispositivo({ grupo: g });
        const n = grupos[g].length;
        return (
          <div
            key={g}
            // En cero se apaga entero: un cuadro cobre junto a «0 En unidad»
            // pinta de vida lo que no hay.
            className={`flex items-center gap-2.5 rounded-lg border border-[var(--linea)] px-3 py-2.5 ${n === 0 ? "border-dashed opacity-60" : "bg-[var(--pieza)]"}`}
          >
            <Glifo estado={glifo} tamano={20} />
            <span>
              <span data-medida className="block text-[18px] leading-none">
                {n}
              </span>
              <span className="mt-1 block text-[12px] text-[var(--tenue)]">{palabra}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PiezaDeInventario({ d, ahora, ficha }: { d: DispositivoDelInventario; ahora: Date; ficha: string }) {
  const { glifo } = glifoDeDispositivo(d.estado);
  const deBaja = d.estado.grupo === "de_baja";
  const senal = d.estado.ultimaSenalAt;
  return (
    <Pieza
      estado={glifo}
      nombre={d.nombre ?? d.imei}
      apoyo={apoyoDeInventario(d)}
      // De baja, lo que importa es cuándo salió; en servicio, de cuándo es su señal.
      dato={deBaja && d.estado.grupo === "de_baja" ? diaDe(d.estado.retiredAt, JTTEL_TZ) : senal ? edad(senal, ahora) : "nunca"}
      etiqueta={deBaja ? "de baja" : "última señal"}
      edad={null}
      datoVivo={senalViva(d.estado, ahora)}
      apagada={d.estado.grupo === "desconectado" || deBaja}
      ficha={ficha}
    />
  );
}

function PanelDeAlta({ cuenta, cancelar, imei, error }: { cuenta: string; cancelar: string; imei: string; error: string | null }) {
  const modelo = MODELOS_DE_DISPOSITIVO[0];
  return (
    <form action="/api/casa/dispositivos" method="post" className={clases.panel} aria-label="Dar de alta un dispositivo">
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        Dar de alta un dispositivo
      </h3>
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value="alta" />
      <input type="hidden" name="prefijo" value={modelo.prefijo} />
      <Renglon pregunta="Modelo">
        {modelo.marca} {modelo.modelo}
      </Renglon>
      <CampoImei inicial={imei} errorDeRuta={error} />
      <p className={clases.nota}>
        El nombre lo pone el sistema al guardar: marca, modelo y el siguiente número de la plataforma. Queda en bodega.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={clases.primario}>
          Dar de alta
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
