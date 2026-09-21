import Link from "next/link";
import { localDateIso, type FranjaCapturada } from "@jtel/domain";
import { AppNav, Card } from "@/components/ui";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { resumenDeLaPromesa } from "@/lib/promesa-por-franja";

export const dynamic = "force-dynamic";

/**
 * La puerta de entrada del transporte concesionado: dar de alta una concesión,
 * dar de alta sus circuitos, y entrar a editarlos.
 *
 * Los tres campos del circuito vienen con los valores del circuito 1 ya puestos
 * en el formulario, pero **son campos del formulario, no constantes**: se editan
 * aquí y después en la pantalla del circuito, sin desplegar nada.
 */
export default async function CircuitosPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });

  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const ok = typeof sp?.ok === "string" ? sp.ok : null;

  const repos = getRepos();
  const [concesiones, circuitos, transportistas, franjas] = await Promise.all([
    repos.circuits.listConcessions(),
    repos.circuits.listAllCircuits(),
    repos.accounts.listByType("carrier"),
    repos.circuits.listFranjasVigentesDeTodos(),
  ]);

  // La promesa de cada circuito, de las franjas (la única fuente, 21 sep 2026).
  // Sin fila: nunca capturada. Fila con día nulo: promesa vigente vacía.
  const promesaDe = new Map<string, FranjaCapturada[]>();
  for (const f of franjas) {
    const lista = promesaDe.get(f.circuitId) ?? [];
    if (f.diaTipo && f.desdeLocal && f.hastaLocal && f.frequencyMinutes) {
      lista.push({
        diaTipo: f.diaTipo,
        sentido: f.sentido,
        desdeLocal: f.desdeLocal,
        hastaLocal: f.hastaLocal,
        frequencyMinutes: f.frequencyMinutes,
      });
    }
    promesaDe.set(f.circuitId, lista);
  }

  /*
   * Los transportistas ligados a cada concesión.
   *
   * Se cargan aquí porque son el eslabón que abre la asignación de unidades:
   * una concesión sin transportista ligado no tiene de dónde escoger un camión,
   * y esa lista vacía es indistinguible de «todavía no asignas ninguna». La
   * pantalla lo dice en vez de dejar deducirlo.
   */
  const ligas = await Promise.all(
    concesiones.map(async (c) => ({
      accountId: c.accountId,
      filas: await repos.circuits.listConcessionCarriers(c.accountId),
    })),
  );
  const ligasPorConcesion = new Map(ligas.map((l) => [l.accountId, l.filas]));

  const campo = "w-full rounded border border-[var(--linea-tenue)] bg-transparent px-2 py-1 text-sm";
  const etiqueta = "block text-xs text-[var(--muted)] mb-1";

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Transporte concesionado — concesiones y circuitos"
          links={[
            { href: "/jstaff", label: "← Panel" },
            { href: "/jstaff/circuitos", label: "Circuitos" },
          ]}
        />

        {error && (
          <p className="mb-4 rounded border border-[var(--linea-tenue)] p-3 text-sm">⚠ {error}</p>
        )}
        {ok && (
          <p className="mb-4 rounded border border-[var(--linea-tenue)] p-3 text-sm">✓ {ok}</p>
        )}

        <Card>
          <h2 className="mb-1 font-medium">1 · Concesiones</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            La concesión es la dueña de sus circuitos. Un carrier los opera, pero no los posee.
          </p>

          {concesiones.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--muted)]">Ninguna todavía.</p>
          ) : (
            <ul className="mb-3 text-sm">
              {concesiones.map((c) => {
                const suyos = ligasPorConcesion.get(c.accountId) ?? [];
                const vigentes = suyos.filter((l) => !l.validTo);
                const libres = transportistas.filter(
                  (t) => !vigentes.some((l) => l.carrierAccountId === t.id),
                );
                return (
                  <li key={c.accountId} className="border-t border-[var(--linea-tenue)] py-2">
                    <strong>{c.name}</strong>
                    {c.numeroConcesion ? (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        concesión {c.numeroConcesion}
                      </span>
                    ) : null}

                    {/*
                      Quién puede correr sus circuitos. Va aquí y no en la
                      pantalla del circuito porque la liga es de la concesión:
                      ponerla junto al circuito haría creer que se decide
                      circuito por circuito.
                    */}
                    <div className="mt-1.5 pl-1">
                      {vigentes.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">
                          Sin transportistas ligados — ninguna unidad se puede asignar a sus
                          circuitos todavía.
                        </p>
                      ) : (
                        <ul className="text-xs">
                          {vigentes.map((l) => (
                            <li key={l.id} className="flex items-center gap-2 py-0.5">
                              <span className="text-[var(--texto)]">{l.carrierName}</span>
                              {/*
                                En la zona del despliegue, no en UTC.
                                `toISOString()` cortaba el día en UTC y una liga
                                hecha a las 22:55 de Juárez salía fechada al día
                                siguiente: el valor era correcto y la afirmación
                                falsa.
                              */}
                              <span className="font-[family-name:var(--fuente-mono)] tabular-nums text-[var(--acero)]">
                                desde {localDateIso(l.validFrom)}
                              </span>
                              <form
                                action={`/api/jstaff/concesiones/${c.accountId}/transportistas`}
                                method="post"
                              >
                                <input type="hidden" name="accion" value="terminar" />
                                <input type="hidden" name="ligaId" value={l.id} />
                                <button
                                  type="submit"
                                  className="text-[var(--muted)] underline hover:text-[var(--azul)]"
                                >
                                  desligar
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}

                      {libres.length > 0 && (
                        <form
                          action={`/api/jstaff/concesiones/${c.accountId}/transportistas`}
                          method="post"
                          className="mt-1.5 flex items-center gap-2"
                        >
                          <label
                            className="sr-only"
                            htmlFor={`carrier-${c.accountId}`}
                          >
                            Ligar un transportista a {c.name}
                          </label>
                          <select
                            id={`carrier-${c.accountId}`}
                            name="carrierAccountId"
                            required
                            className="rounded border border-[var(--linea-tenue)] bg-transparent px-2 py-1 text-xs"
                          >
                            <option value="">Ligar un transportista…</option>
                            {libres.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded border border-[var(--linea-tenue)] px-2 py-1 text-xs"
                          >
                            Ligar
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <form action="/api/jstaff/concesiones" method="post" className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={etiqueta} htmlFor="nombre">
                Nombre
              </label>
              <input id="nombre" name="nombre" required className={campo} placeholder="Juárez Bus" />
            </div>
            <div>
              <label className={etiqueta} htmlFor="razonSocial">
                Razón social (opcional)
              </label>
              <input id="razonSocial" name="razonSocial" className={campo} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="numeroConcesion">
                Número de concesión (opcional)
              </label>
              <input id="numeroConcesion" name="numeroConcesion" className={campo} />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                className="rounded border border-[var(--linea-tenue)] px-3 py-1 text-sm"
              >
                Dar de alta la concesión
              </button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">2 · Circuitos</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            El slug público va en la URL de la app. Escógelo con calma: se comparte y no conviene
            cambiarlo después.
          </p>

          {circuitos.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--muted)]">Ninguno todavía.</p>
          ) : (
            <ul className="mb-3 text-sm">
              {circuitos.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between border-t border-[var(--linea-tenue)] py-2"
                >
                  <span>
                    <strong>{c.name}</strong>
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      {c.concessionName} ·{" "}
                      {/* Sin capturar se enuncia, no se rellena con un número que nadie declaró. */}
                      {resumenDeLaPromesa(promesaDe.get(c.id) ?? null)}{" "}
                      · <code>{c.publicSlug}</code>
                    </span>
                  </span>
                  <Link href={`/jstaff/circuitos/${c.id}`} className="text-sm underline">
                    Abrir editor →
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {concesiones.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Primero da de alta una concesión: un circuito siempre pertenece a una.
            </p>
          ) : (
            <form action="/api/jstaff/circuitos" method="post" className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className={etiqueta} htmlFor="concesionAccountId">
                  Concesión dueña
                </label>
                <select id="concesionAccountId" name="concesionAccountId" className={campo} required>
                  {concesiones.map((c) => (
                    <option key={c.accountId} value={c.accountId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiqueta} htmlFor="nombreCircuito">
                  Nombre del circuito
                </label>
                <input
                  id="nombreCircuito"
                  name="nombre"
                  required
                  className={campo}
                  placeholder="Oasis–Centro"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={etiqueta} htmlFor="publicSlug">
                  Slug público (minúsculas, números y guiones)
                </label>
                <input
                  id="publicSlug"
                  name="publicSlug"
                  required
                  pattern="[a-z0-9\-]{3,60}"
                  className={campo}
                  placeholder="oasis-centro"
                />
              </div>

              {/*
                La frecuencia ya no se da de alta aquí: se captura por franja en
                el expediente del circuito, la única fuente de la promesa
                (decisión de Asav, 21 sep 2026).
              */}

              {/*
                Las perillas de medición van VACÍAS con su valor de origen como
                marca de agua. Un `placeholder` no se envía, así que no puede
                confundirse con un valor decidido — y aun así deja ver con qué
                nace el circuito, que es la mitad de la pregunta.

                Se ajustan en el expediente, donde cada una lleva su explicación
                al lado. Aquí sólo estorbarían: seis números sin lectura son la
                pantalla que este frente vino a arreglar.
              */}
              <div className="sm:col-span-3">
                <p className="text-xs text-[var(--muted)]">
                  Lo de abajo son perillas de medición. Vacías toman su valor de origen, y se
                  ajustan en el expediente con su explicación al lado.
                </p>
              </div>
              {(
                [
                  ["velocidadKmh", "Velocidad efectiva (km/h)", 20.5, 0.1],
                  ["corredorEnRutaM", "Cuenta como EN RUTA hasta (m)", 150, 1],
                  ["frescuraSeg", "La posición dice dónde está hasta los (seg)", 180, 1],
                  ["confianzaMin", "Sigue habiendo servicio hasta los (min)", 15, 1],
                  ["pisoRangoSeg", "Piso del tiempo estimado (seg)", 180, 1],
                  ["pegadoParadasM", "Pegado de paradas al trazado (m)", 25, 1],
                ] as const
              ).map(([nombreCampo, rotulo, origen, paso]) => (
                <div key={nombreCampo}>
                  <label className={etiqueta} htmlFor={nombreCampo}>
                    {rotulo}
                  </label>
                  <input
                    id={nombreCampo}
                    name={nombreCampo}
                    type="number"
                    min={paso}
                    step={paso}
                    placeholder={`origen: ${origen}`}
                    className={campo}
                  />
                </div>
              ))}
              {/*
                La velocidad es la única de las seis que necesita su nota aquí, y
                no en el expediente nada más: es la que decide si el tiempo
                estimado se puede encender, y el número de origen viene de una
                flota que no es ésta.
              */}
              <div className="sm:col-span-3">
                <p className="text-xs text-[var(--muted)]">
                  Los 20.5 km/h de origen se midieron sobre <strong>otra flota</strong> —9 118
                  ventanas, 35 aparatos, 14 días—, no sobre este circuito. Por eso el tiempo
                  estimado de llegada nace apagado: se enciende cuando la velocidad ya se calibró
                  contra la calle.
                </p>
              </div>
              <div>
                <label className={etiqueta} htmlFor="horaInicio">
                  Inicio de servicio
                </label>
                <input id="horaInicio" name="horaInicio" type="time" className={campo} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="horaFin">
                  Fin de servicio
                </label>
                <input id="horaFin" name="horaFin" type="time" className={campo} />
              </div>
              {/*
                El horario tampoco viene prellenado, y por la misma razón que la
                frecuencia: la app lo dice en voz alta —«servicio declarado de
                05:00 a 23:00»— atribuido al concesionario.

                ⚠ Con una diferencia que conviene no perder: la columna es NOT
                NULL, así que vacío aquí **no guarda «sin declarar»**, guarda
                05:00–23:00. No hay estado «sin horario» en el modelo. El
                expediente lo enuncia como valor de origen en vez de fingir que
                alguien lo escogió; hacerlo anulable como la frecuencia es una
                migración y una decisión, no un arreglo de paso.
              */}
              <div className="sm:col-span-3">
                <p className="text-xs text-[var(--muted)]">
                  Vacíos, el circuito nace de 05:00 a 23:00 en la zona de Cd. Juárez. La app se lo
                  atribuye al concesionario, así que conviene confirmarlo con él antes del día uno.
                </p>
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="rounded border border-[var(--linea-tenue)] px-3 py-1 text-sm"
                >
                  Crear circuito y abrir su editor
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
