import { notFound } from "next/navigation";
import { cargarExpedienteDeChofer } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { SinCuenta } from "@/components/casa/expediente";
import { VistaDePapel, accionDePapel, autoresDelPapel } from "@/components/casa/pagina-de-papel";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { correosDeAutores } from "@/lib/casa/autores";
import { rutas } from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

/**
 * Un papel del expediente de un chofer (Choferes V1). La pantalla vive en
 * `components/casa/pagina-de-papel.tsx`, compartida con la unidad: aquí sólo se
 * carga el chofer —de esta cuenta, o 404— y su papel. Examen médico y
 * antidoping no están en `papeles`: esperan al abogado, y su dirección es 404.
 */
export default async function VerPapelDeChofer({
  params,
  searchParams,
}: {
  params: Promise<{ driverId: string; tipoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("papel-de-chofer");
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
  const { driverId, tipoId } = await params;
  const sp = await searchParams;

  const e = await cargarExpedienteDeChofer(getRepos(), { carrierAccountId: carrier.id, driverId, ahora: new Date() });
  reloj.marca("datos");
  reloj.fin();
  if (!e || e.documentos.estado !== "con_datos") notFound();
  const docs = e.documentos.valor;
  const papel = docs.papeles.find((p) => p.tipo.id === tipoId);
  if (!papel) notFound();

  const nombre = e.identidad.nombre.estado === "con_datos" ? e.identidad.nombre.valor : "Chofer";
  const autores = await correosDeAutores(autoresDelPapel(papel));

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa}>
      <VistaDePapel
        sujeto={{
          campo: "choferId",
          id: driverId,
          nombre,
          ficha: rutas.chofer(driverId, cuentaEnRuta),
          rutaDelPapel: (accion) => rutas.papelDeChofer(driverId, tipoId, cuentaEnRuta, accion),
        }}
        papel={papel}
        docs={docs}
        cuenta={carrier.slug}
        cuentaEnRuta={cuentaEnRuta}
        accion={accionDePapel(sp.accion)}
        sp={sp}
        quien={(id) => (id ? (autores.get(id) ?? id) : "sin autor")}
      />
    </Marco>
  );
}
