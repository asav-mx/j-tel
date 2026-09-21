import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { AvisoDeError, Titular } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";

export const dynamic = "force-dynamic";

/**
 * Nuevo circuito — pide lo mínimo y abre el expediente (PR A1).
 *
 * **La escritura es la de siempre** (`POST /api/jstaff/circuitos`): esta
 * pantalla sólo le manda `volver` para que regrese al cuarto nuevo en vez de a
 * la pantalla vieja. No se duplica ninguna lógica.
 *
 * **El horario va explícito y sin valor de fábrica** (ASAV, 21-sep-2026). La
 * ruta acepta el alta sin horario —y entonces la base pone el de origen, que la
 * pantalla vieja sigue permitiendo—; aquí los dos campos son obligatorios y
 * nacen vacíos: un horario que nadie escribió no puede quedar guardado como si
 * alguien lo hubiera decidido.
 */
export default async function NuevoCircuito({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const [concesiones, sp] = await Promise.all([getRepos().circuits.listConcessions(), searchParams]);
  const error = typeof sp.error === "string" ? sp.error : null;

  const etiqueta = "flex flex-col gap-1.5 text-[13px] font-semibold";

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA} lugar="/casa/jstaff/circuitos">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <Migas pasos={[{ nombre: "Circuitos", ruta: "/casa/jstaff/circuitos" }, { nombre: "Nuevo circuito" }]} />
        <Titular nombre="Nuevo circuito" bajo="lo mínimo; lo demás se captura en su expediente" />
        {error && <AvisoDeError mensaje={error} />}

        <form action="/api/jstaff/circuitos" method="post" className={clases.panel}>
          <input type="hidden" name="volver" value="/casa/jstaff/circuitos" />

          <label className={etiqueta}>
            Concesión dueña
            <select name="concesionAccountId" required defaultValue="" className={clases.campo}>
              <option value="" disabled>
                Escoge la concesión
              </option>
              {concesiones.map((c) => (
                <option key={c.accountId} value={c.accountId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className={etiqueta}>
            Nombre
            <input name="nombre" required autoComplete="off" className={clases.campo} placeholder="Oasis–Centro" />
          </label>

          <label className={etiqueta}>
            Identificador público
            <input
              name="publicSlug"
              required
              pattern="[a-z0-9-]{3,60}"
              autoComplete="off"
              className={`${clases.campo} font-[family-name:var(--letra-medida)]`}
              placeholder="oasis-centro"
            />
            <span className={clases.ayuda}>
              Va en la dirección pública y en el QR impreso: minúsculas, números y guiones. No se cambia después de
              imprimir.
            </span>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[13px] font-semibold">Horario de servicio</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-[var(--tenue)]">
                abre
                <input type="time" name="horaInicio" required className={`${clases.campo} w-auto`} />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[var(--tenue)]">
                cierra
                <input type="time" name="horaFin" required className={`${clases.campo} w-auto`} />
              </label>
            </div>
            <span className={clases.ayuda}>Sin valor de fábrica: el horario lo decide quien da de alta.</span>
          </fieldset>

          <div>
            <button type="submit" className={clases.primario}>
              Crear y abrir su expediente
            </button>
          </div>
        </form>
      </div>
    </Marco>
  );
}
