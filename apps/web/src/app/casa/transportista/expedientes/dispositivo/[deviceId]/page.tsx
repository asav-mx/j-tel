import { notFound } from "next/navigation";
import { JTTEL_TZ } from "@jtel/domain";
import { cargarExpedienteDeDispositivo } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Pieza } from "@/components/casa/pieza";
import { Familia, Parte, Renglon, SinCuenta, Titular } from "@/components/casa/expediente";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { diaDe, edad, glifoDeDispositivo, rutas } from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

/**
 * Ver ‹dispositivo› — el expediente de un dispositivo (Marco 6.30–6.33).
 *
 * Identidad, actividad y relaciones. **Sin familia de documentos**: un
 * dispositivo no lleva papeles, así que no aplica y no se dibuja (decidido el
 * 16 sep 2026). La baja aparece sólo si la tiene.
 */
export default async function VerDispositivo({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const cuenta = await cuentaDelCuarto(searchParams);
  if (!cuenta) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS}>
        <SinCuenta />
      </Marco>
    );
  }
  const { carrier, cuentaEnRuta } = cuenta;
  const { deviceId } = await params;
  const ahora = new Date();

  const e = await cargarExpedienteDeDispositivo(getRepos(), { carrierAccountId: carrier.id, deviceId, ahora });
  if (!e) notFound();

  const imei = e.identidad.imei.estado === "con_datos" ? e.identidad.imei.valor : "";
  const nombre = e.identidad.nombre.estado === "con_datos" ? e.identidad.nombre.valor : imei;
  const estado = e.actividad.ultimaSenal.estado === "con_datos" ? glifoDeDispositivo(e.actividad.ultimaSenal.valor.estado).palabra : null;

  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={[{ nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) }, { nombre: `Ver ${nombre}` }]} />
        <Titular nombre={nombre} bajo={[estado, carrier.name].filter(Boolean).join(" · ")} />

        <Familia nombre="Identidad">
          <Parte pregunta="Nombre" parte={e.identidad.nombre} vacia="Sin nombre" conDatos={(v) => <Renglon pregunta="Nombre" medida>{v}</Renglon>} />
          <Parte pregunta="IMEI" parte={e.identidad.imei} vacia="Sin IMEI" conDatos={(v) => <Renglon pregunta="IMEI" medida>{v}</Renglon>} />
          {e.identidad.baja && (
            <Parte
              pregunta="Baja"
              parte={e.identidad.baja}
              vacia=""
              conDatos={(b) => (
                <Renglon pregunta="De baja" medida>
                  {diaDe(b.at, JTTEL_TZ)} · {b.motivo ?? "sin motivo"}
                </Renglon>
              )}
            />
          )}
        </Familia>

        <Familia nombre="Actividad">
          <Parte
            pregunta="Última señal"
            parte={e.actividad.ultimaSenal}
            vacia="Nunca ha reportado"
            conDatos={(s) => {
              const g = glifoDeDispositivo(s.estado);
              return (
                <Pieza
                  estado={g.glifo}
                  nombre={g.palabra}
                  apoyo={s.estado.grupo === "en_bodega" ? "sin unidad" : "transmitiendo por su unidad"}
                  dato={edad(s.at, ahora)}
                  etiqueta="última señal"
                  edad={null}
                  apagada={s.estado.grupo === "desconectado" || s.estado.grupo === "de_baja"}
                />
              );
            }}
          />
        </Familia>

        <Familia nombre="Relaciones">
          <Parte
            pregunta="Unidades"
            parte={e.relaciones.unidades}
            vacia="Nunca ha estado en una unidad"
            conDatos={(lista) => (
              <div className="flex flex-col gap-2">
                {[...lista].reverse().map((u) => (
                  <Pieza
                    key={`${u.unitId}-${u.desde.toISOString()}`}
                    nombre={u.etiqueta}
                    apoyo={u.vigente ? `desde ${diaDe(u.desde, JTTEL_TZ)}` : `hasta ${u.hasta ? diaDe(u.hasta, JTTEL_TZ) : "—"}`}
                    dato={u.vigente ? "vigente" : "antes"}
                    etiqueta="unidad"
                    edad={null}
                    apagada={!u.vigente}
                    ficha={rutas.unidad(u.unitId, cuentaEnRuta)}
                  />
                ))}
              </div>
            )}
          />
        </Familia>
      </div>
    </Marco>
  );
}
