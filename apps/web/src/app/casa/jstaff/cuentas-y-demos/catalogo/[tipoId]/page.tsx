import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDEN_DE_ESTADOS, type NombreDeEstadoDePapel, type ReglaDeTipo } from "@jtel/domain";
import { cargarReglaDeUnTipo, revisarEfectoDeRegla } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { AvisoDeError, Familia, Renglon, Titular } from "@/components/casa/expediente";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { correosDeAutores } from "@/lib/casa/autores";
import { diaDe, fechaCorta } from "@/lib/casa/expedientes";
import {
  AVISO_MAXIMO,
  CAMPOS_DE_REGLA,
  LARGO_NOTA_MAXIMO,
  PERIODICIDAD_MAXIMA,
  faltantesEnPalabras,
  reglaEnPalabras,
  revisarRegla,
  rutasDelCatalogo,
  tresEstadosDe,
} from "@/lib/casa/regla";

export const dynamic = "force-dynamic";

const titular = { fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.02em" } as const;
const boton =
  "inline-flex cursor-pointer items-center rounded-lg border px-4 py-2.5 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]";
const primario = `${boton} border-[var(--tinta)] bg-[var(--tinta)] text-[var(--papel)]`;
const secundario = `${boton} border-[var(--linea)] text-[var(--tinta)] hover:bg-[var(--roce)]`;
const campo =
  "w-full rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3 py-2.5 text-[14px] text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]";

const ESTADO_EN_PALABRAS: Record<NombreDeEstadoDePapel, string> = {
  vencido: "Vencido",
  falta: "Falta",
  falta_la_fecha: "Falta la fecha",
  por_vencer: "Por vencer",
  falta_la_regla: "Sin regla",
  vigente: "Vigente",
  sin_vencimiento: "No vence",
  no_capturado: "Opcional sin capturar",
};

const siNo = (v: boolean | null) => (v === true ? "sí" : v === false ? "no" : "sin decidir");

/**
 * Un tipo del catálogo: su regla vigente, su historia, a quién juzga, y cómo se
 * cambia (D2).
 *
 * Tres momentos en la misma página, con `?accion=`:
 * - **ver**: la regla vigente y su historia, cada versión con su autor y su nota.
 * - **editar**: el formulario. Abre con la regla vigente; la nota, vacía, porque
 *   cada versión dice de dónde sale ella.
 * - **revisar**: antes de guardar, el efecto. Cuántos papeles del mercado cambian
 *   de estado con la regla propuesta. Nada se escribe hasta «Guardar versión».
 */
export default async function TipoDelCatalogo({
  params,
  searchParams,
}: {
  params: Promise<{ tipoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const { tipoId } = await params;
  const sp = await searchParams;
  const leer = (c: string) => (typeof sp[c] === "string" ? (sp[c] as string) : undefined);

  const repos = getRepos();
  const datos = await cargarReglaDeUnTipo(repos, { documentTypeId: tipoId });
  if (!datos) notFound();

  const ahora = new Date();
  let accion = leer("accion") === "editar" || leer("accion") === "revisar" ? leer("accion")! : null;
  let error = leer("error") ?? null;
  const vienenCampos = CAMPOS_DE_REGLA.some((c) => leer(c) !== undefined);

  // Revisar sólo con una regla válida; si no lo es, se vuelve a editar con el aviso.
  const revisada = accion === "revisar" ? revisarRegla((c) => leer(c)) : null;
  if (revisada && !revisada.ok) {
    accion = "editar";
    error = revisada.error;
  }
  const efecto =
    revisada?.ok ? await revisarEfectoDeRegla(repos, { documentTypeId: tipoId, propuesta: revisada.escrita.regla, ahora }) : null;

  const autores = accion ? new Map<string, string>() : await correosDeAutores(datos.historial.map((h) => h.actorId));
  const pasos = [
    { nombre: "Catálogo de documentos", ruta: rutasDelCatalogo.catalogo(datos.mercado.id) },
    { nombre: datos.tipo.nombre, ruta: accion ? rutasDelCatalogo.tipo(tipoId) : undefined },
    ...(accion ? [{ nombre: accion === "editar" ? "Editar" : "Revisar" }] : []),
  ];

  const inicial = {
    obligatorio: vienenCampos ? (leer("obligatorio") ?? "") : tresEstadosDe(datos.regla?.obligatorio),
    vence: vienenCampos ? (leer("vence") ?? "") : tresEstadosDe(datos.regla?.vence),
    diasDeAviso: vienenCampos ? (leer("diasDeAviso") ?? "") : (datos.regla?.diasDeAviso?.toString() ?? ""),
    periodicidadMeses: vienenCampos ? (leer("periodicidadMeses") ?? "") : (datos.regla?.periodicidadMeses?.toString() ?? ""),
    nota: vienenCampos ? (leer("nota") ?? "") : "",
  };

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={pasos} />
        <Titular
          nombre={accion === "revisar" ? "Revisar el cambio" : datos.tipo.nombre}
          bajo={`${accion === "revisar" ? `${datos.tipo.nombre} · ` : ""}${datos.mercado.nombre} · papel de ${datos.tipo.sujeto}`}
        />

        {accion === "editar" && <Formulario tipoId={tipoId} inicial={inicial} error={error} />}

        {accion === "revisar" && revisada?.ok && efecto && (
          <Revision
            tipoId={tipoId}
            sujeto={datos.tipo.sujeto}
            actual={datos.regla}
            propuesta={revisada.escrita.regla}
            nota={revisada.escrita.nota}
            efecto={efecto}
            campos={inicial}
          />
        )}

        {!accion && (
          <>
            <Familia nombre="La regla vigente">
              <Renglon pregunta="Obligatorio" medida>{siNo(datos.regla?.obligatorio ?? null)}</Renglon>
              <Renglon pregunta="Vence" medida>{siNo(datos.regla?.vence ?? null)}</Renglon>
              {datos.regla?.vence === true && (
                <>
                  <Renglon pregunta="Cada cuántos meses" medida>
                    {datos.regla.periodicidadMeses ?? "no se calcula"}
                  </Renglon>
                  <Renglon pregunta="Días de aviso" medida>
                    {datos.regla.diasDeAviso === null ? "sin decidir" : `${datos.regla.diasDeAviso} d`}
                  </Renglon>
                </>
              )}
              {datos.faltan.length > 0 && (
                <p className="px-1 text-[13px] text-[var(--tenue)]">
                  Mientras falte {faltantesEnPalabras(datos.faltan)}, los papeles de este tipo dicen «sin regla».
                </p>
              )}
            </Familia>

            <div className="flex flex-wrap gap-2.5">
              <Link href={rutasDelCatalogo.accion(tipoId, "editar")} className={primario}>
                {datos.regla ? "Cambiar la regla" : "Cargar la regla"}
              </Link>
            </div>

            <Familia nombre="Historia de la regla">
              <ol className="flex flex-col rounded-lg border border-[var(--linea)] bg-[var(--pieza)]">
                {datos.historial.map((h) => (
                  <li key={h.id} className="flex flex-col gap-1 border-t border-[var(--linea)] px-4 py-2.5 first:border-t-0">
                    <span className="text-[13px]">{reglaEnPalabras(h.regla)}{h.regla.vence && h.regla.diasDeAviso !== null ? ` · ${h.regla.diasDeAviso} d de aviso` : ""}</span>
                    {h.nota && <span className="text-[13px] text-[var(--tenue)]">«{h.nota}»</span>}
                    <span data-medida className="text-[12px] text-[var(--tenue)]">
                      {diaDe(h.guardadaAt, datos.mercado.zonaHoraria)} · {h.actorId ? (autores.get(h.actorId) ?? h.actorId) : "sin autor"}
                    </span>
                  </li>
                ))}
                <li className="border-t border-[var(--linea)] px-4 py-2.5 text-[13px] text-[var(--tenue)] first:border-t-0">
                  Nació sin regla, con la migración 0038
                </li>
              </ol>
            </Familia>

            <Familia nombre="A quién juzga">
              <Renglon pregunta="Cuentas del mercado">{datos.juzga.cuentas.join(", ") || "ninguna todavía"}</Renglon>
              <Renglon pregunta={datos.tipo.sujeto === "unidad" ? "Unidades activas" : "Choferes activos"} medida>
                {datos.juzga.sujetos}
              </Renglon>
            </Familia>
          </>
        )}
      </div>
    </Marco>
  );
}

function Formulario({
  tipoId,
  inicial,
  error,
}: {
  tipoId: string;
  inicial: Record<(typeof CAMPOS_DE_REGLA)[number], string>;
  error: string | null;
}) {
  const tres = (nombre: "obligatorio" | "vence", leyenda: string, ayuda?: string) => (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 pb-3.5 pt-2.5">
      <legend className="px-1 text-[13px]">{leyenda}</legend>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["si", "Sí"],
            ["no", "No"],
            ["sin_decidir", "Sin decidir"],
          ] as const
        ).map(([valor, texto]) => (
          <label
            key={valor}
            htmlFor={`${nombre}-${valor}`}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--linea)] px-3 py-1.5 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--tinta)]"
          >
            <input id={`${nombre}-${valor}`} type="radio" name={nombre} value={valor} defaultChecked={inicial[nombre] === valor} required className="accent-[var(--tinta)]" />
            {texto}
          </label>
        ))}
      </div>
      {ayuda && <span className="text-[12px] text-[var(--tenue)]">{ayuda}</span>}
    </fieldset>
  );

  return (
    // GET a la misma página: revisar no escribe nada. Guardar es otro paso.
    <form method="get" action={rutasDelCatalogo.tipo(tipoId)} className="flex flex-col gap-4">
      <p className="text-[14px] text-[var(--tenue)]">
        Se guarda como versión nueva. La anterior queda en la historia, y antes de guardar se revisa a cuántos papeles
        cambia.
      </p>
      {error && <AvisoDeError mensaje={error} />}
      <input type="hidden" name="accion" value="revisar" />
      {tres("obligatorio", "¿Es obligatorio?", "Sin decidir, un papel que nadie ha capturado dice «sin regla»: no se da por faltante ni por opcional.")}
      {tres("vence", "¿Vence?")}
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="diasDeAviso" className="flex flex-col gap-1.5 text-[13px]">
          Días de aviso
          <input id="diasDeAviso" name="diasDeAviso" inputMode="numeric" pattern="[0-9]*" defaultValue={inicial.diasDeAviso} data-medida className={campo} />
          <span className="text-[12px] text-[var(--tenue)]">De 0 a {AVISO_MAXIMO}. Cuántos días antes de vencer pasa a «por vencer». Sólo si vence.</span>
        </label>
        <label htmlFor="periodicidadMeses" className="flex flex-col gap-1.5 text-[13px]">
          Cada cuántos meses
          <input id="periodicidadMeses" name="periodicidadMeses" inputMode="numeric" pattern="[0-9]*" defaultValue={inicial.periodicidadMeses} data-medida className={campo} />
          <span className="text-[12px] text-[var(--tenue)]">Opcional, de 1 a {PERIODICIDAD_MAXIMA}. Si el papel no trae su fecha, se calcula desde la emisión.</span>
        </label>
      </div>
      <label htmlFor="nota" className="flex flex-col gap-1.5 text-[13px]">
        De dónde sale la regla
        <textarea id="nota" name="nota" required minLength={5} maxLength={LARGO_NOTA_MAXIMO} rows={3} defaultValue={inicial.nota} placeholder="La ley, el artículo, el oficio." className={`${campo} font-[inherit]`} />
        <span className="text-[12px] text-[var(--tenue)]">Obligatoria. Es lo que permite defender el número el día que alguien pregunte por qué.</span>
      </label>
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className={primario}>
          Revisar el cambio
        </button>
        <Link href={rutasDelCatalogo.tipo(tipoId)} className={secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Revision({
  tipoId,
  sujeto,
  actual,
  propuesta,
  nota,
  efecto,
  campos,
}: {
  tipoId: string;
  sujeto: "unidad" | "chofer";
  actual: ReglaDeTipo | null;
  propuesta: ReglaDeTipo;
  nota: string;
  efecto: NonNullable<Awaited<ReturnType<typeof revisarEfectoDeRegla>>>;
  campos: Record<(typeof CAMPOS_DE_REGLA)[number], string>;
}) {
  const estados = ORDEN_DE_ESTADOS.filter((e) => efecto.antes[e] > 0 || efecto.despues[e] > 0);
  const titularDelEfecto =
    efecto.sujetos === 0
      ? `Todavía no juzga ${sujeto === "unidad" ? "ninguna unidad" : "ningún chofer"}`
      : efecto.pasanAPedirAlgo === 0
        ? "Ningún papel pasa a pedir algo"
        : `${efecto.pasanAPedirAlgo} ${efecto.pasanAPedirAlgo === 1 ? "papel pasa" : "papeles pasan"} a pedir algo`;
  const aviso = (r: ReglaDeTipo | null) => (r?.vence === true && r.diasDeAviso !== null ? `${r.diasDeAviso} d` : "—");
  const meses = (r: ReglaDeTipo | null) => (r?.vence === true && r.periodicidadMeses ? `${r.periodicidadMeses}` : "—");

  return (
    <>
      <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] p-5">
        <p className="text-[22px] leading-tight" style={titular}>
          {titularDelEfecto}
        </p>
        <p data-medida className="text-[13px] text-[var(--tenue)]">
          {[
            efecto.cuentas.join(", ") || "sin cuentas",
            `${efecto.sujetos} ${sujeto === "unidad" ? "unidades activas" : "choferes activos"}`,
            `juzgado el ${fechaCorta(efecto.hoy)}`,
            efecto.dejanDePedirAlgo ? `${efecto.dejanDePedirAlgo} dejan de pedir algo` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <Familia nombre="La regla">
        <Renglon pregunta="Obligatorio" medida>{siNo(actual?.obligatorio ?? null)} → {siNo(propuesta.obligatorio)}</Renglon>
        <Renglon pregunta="Vence" medida>{siNo(actual?.vence ?? null)} → {siNo(propuesta.vence)}</Renglon>
        <Renglon pregunta="Cada cuántos meses" medida>{meses(actual)} → {meses(propuesta)}</Renglon>
        <Renglon pregunta="Días de aviso" medida>{aviso(actual)} → {aviso(propuesta)}</Renglon>
        <Renglon pregunta="De dónde sale">«{nota}»</Renglon>
      </Familia>

      {estados.length > 0 && (
        <Familia nombre="Lo que dirán los expedientes">
          {/* Una tabla, y aquí sí: se compara columna contra columna (skill). */}
          <div className="overflow-x-auto rounded-lg border border-[var(--linea)] bg-[var(--pieza)]">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr data-medida className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--tenue)]">
                  <th scope="col" className="px-4 py-2 text-left font-normal">Estado</th>
                  <th scope="col" className="px-4 py-2 text-right font-normal">Hoy</th>
                  <th scope="col" className="px-4 py-2 text-right font-normal">Con la regla</th>
                </tr>
              </thead>
              <tbody>
                {estados.map((e) => (
                  <tr key={e} className="border-t border-[var(--linea)]">
                    <th scope="row" className="px-4 py-2 text-left font-normal">{ESTADO_EN_PALABRAS[e]}</th>
                    <td data-medida className="px-4 py-2 text-right tabular-nums">{efecto.antes[e]}</td>
                    <td data-medida className={`px-4 py-2 text-right tabular-nums ${efecto.despues[e] !== efecto.antes[e] ? "font-semibold" : ""}`}>
                      {efecto.despues[e]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-1 text-[13px] text-[var(--tenue)]">
            Nada se reescribe: los estados se calculan al leer, y la regla anterior queda en la historia.
            {efecto.fechasCalculadasConservadas > 0 &&
              ` ${efecto.fechasCalculadasConservadas} ${efecto.fechasCalculadasConservadas === 1 ? "papel conserva su fecha calculada" : "papeles conservan su fecha calculada"} con la periodicidad anterior.`}
          </p>
        </Familia>
      )}

      <form action="/api/casa/jstaff/catalogo/regla" method="post" className="flex flex-wrap gap-2.5">
        <input type="hidden" name="tipoId" value={tipoId} />
        {CAMPOS_DE_REGLA.map((c) => (
          <input key={c} type="hidden" name={c} value={campos[c]} />
        ))}
        <button type="submit" className={primario}>
          Guardar versión
        </button>
        <Link href={rutasDelCatalogo.accion(tipoId, "editar", campos)} className={secundario}>
          Volver a editar
        </Link>
      </form>
    </>
  );
}
