import Link from "next/link";
import { notFound } from "next/navigation";
import { promesaAhora, promesaEnPalabras, situacionDelAviso, velocidadCalibrada, type FranjaCapturada } from "@jtel/domain";
import { ORIGEN_DEL_CIRCUITO } from "@jtel/domain/publico";
import { loMinimoParaMedir } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { AvisoDeError, Renglon, Titular, Vacio } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { CadenaEnEslabones } from "@/components/casa/cadena-del-circuito";
import { EditorDelMapa } from "@/components/casa/editor-del-mapa";
import { AjustesDeMedicion, type Ajuste } from "@/components/casa/ajustes-de-medicion";
import { IdentidadDelCircuito } from "@/components/casa/identidad-del-circuito";
import { HistoriaDeReglas } from "@/components/casa/historia-de-reglas";
import { PromesaDelCircuito } from "@/components/casa/promesa-del-circuito";
import { UnidadesDelCircuito } from "@/components/casa/unidades-del-circuito";
import { AvisosDelCircuito, type AvisoEnPantalla } from "@/components/casa/avisos-del-circuito";
import { correosDeAutores } from "@/lib/casa/autores";
import { SENTIDO_EN_PALABRAS, distanciasEnPalabras, medirParadas } from "@/lib/casa/paradas-del-circuito";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cadenaDelCircuito, loQueFaltaEnPalabras, type Eslabon } from "@/lib/casa/cadena-del-circuito";

export const dynamic = "force-dynamic";

/**
 * Ver ‹circuito› — el expediente de J-Staff en su casa nueva (PR A1 de la ficha
 * de Circuitos, 21-sep-2026).
 *
 * **La cadena de siete pasos arriba**, cada uno con su estado, y la frase de lo
 * que falta para medir. Esa frase sale de `loMinimoParaMedir` (capa de
 * servicios): la misma definición que decide la caja vacía de la torre y su
 * aviso de «sin unidades». Dos definiciones se separan el primer mes.
 *
 * **Escriben desde aquí** Publicar (A1), la promesa y las unidades (A2), y el
 * trazado y las paradas con el editor del mapa de siempre, envuelto sin tocarlo
 * (A3), y la identidad y los ajustes de medición (A4) — siempre con las rutas
 * de siempre. Lo único que sigue en la pantalla vieja es la operación
 * (`operar`); la vieja entera sigue viva hasta el PR D.
 *
 * **Publicar no exige nada** (ASAV, 21-sep: la decisión escrita en la ruta de
 * publicación se queda). Es acto de quien opera; la cadena enuncia lo que
 * falta y no cierra la puerta.
 */
export default async function VerCircuitoJStaff({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) notFound();

  const [concesion, trazados, paradas, asignaciones, promesa, asignables, versiones, reglasCambiadas, avisos] = await Promise.all([
    repos.accounts.findById(circuito.concessionAccountId),
    repos.circuits.getPaths(id),
    repos.circuits.listStopsVigentes(id),
    repos.circuits.listAssignments(id),
    repos.circuits.getPromiseTableVigente(id),
    repos.circuits.listUnidadesAsignables(circuito.concessionAccountId),
    repos.circuits.listPromiseTables(id),
    repos.circuits.listRuleChanges(id),
    repos.circuits.listAvisos(id),
  ]);
  // Desempate por número económico: con la misma fecha, el orden cambiaba de una carga a otra.
  const vigentes = asignaciones
    .filter((a) => a.validTo === null)
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime() || a.unitLabel.localeCompare(b.unitLabel, "es", { numeric: true }));
  const soltadas = asignaciones.filter((a) => a.validTo !== null);
  // Quién asignó, soltó o capturó: correos, de la sesión que firmó (0048, 0049).
  const autores = await correosDeAutores([
    ...asignaciones.flatMap((a) => [a.asignadaPor, a.cerradaPor]),
    ...versiones.map((v) => v.capturadaPor),
    ...reglasCambiadas.map((c) => c.cambiadoPor),
    ...avisos.flatMap((a) => [a.capturadoPor, a.retiradoPor]),
  ]);
  const quien = (idUsuario: string | null) => (idUsuario ? (autores.get(idUsuario) ?? idUsuario) : null);
  const publicado = circuito.publishedAt !== null;

  const minimo = loMinimoParaMedir({
    trazados: trazados.map((t) => ({ sentido: t.sentido as "ida" | "vuelta", puntos: t.pointCount })),
    paradas: paradas.map((p) => ({ sentido: p.sentido as "ida" | "vuelta" | null })),
    franjasDeLaPromesa: promesa ? promesa.bandas.length : null,
    unidadesAsignadas: vigentes.length,
  });
  const cadena = cadenaDelCircuito({
    trazados: trazados.map((t) => ({ sentido: t.sentido as "ida" | "vuelta", puntos: t.pointCount })),
    paradas: paradas.map((p) => ({ sentido: p.sentido as "ida" | "vuelta" | null })),
    franjasDeLaPromesa: promesa ? promesa.bandas.length : null,
    unidadesAsignadas: vigentes.length,
    publicado,
    minimo,
  });
  const eslabon = (paso: Eslabon["paso"]) => cadena.find((e) => e.paso === paso)!;

  const zona = circuito.timeZone;
  const horario = `${circuito.serviceStartLocal.slice(0, 5)}–${circuito.serviceEndLocal.slice(0, 5)}`;
  const dia = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", { timeZone: zona, day: "numeric", month: "short", year: "numeric" }).format(d);
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const porSentido = (s: "ida" | "vuelta") => paradas.filter((p) => p.sentido === s || p.sentido === null).length;
  const trazadosDeSentido = trazados.map((t) => ({
    sentido: t.sentido as "ida" | "vuelta",
    coordinates: t.coordinates as Array<[number, number]>,
  }));
  const paradasConSentido = paradas.map((p) => ({ ...p, sentido: (p.sentido ?? null) as "ida" | "vuelta" | null }));
  // La misma tolerancia con la que el editor avisa al pegar: la del pegado de paradas.
  const medidas = medirParadas(paradasConSentido, trazadosDeSentido, circuito.stopSnapToleranceMeters);
  const lejos = medidas.filter((m) => m.lejos).length;

  /*
   * Los ajustes de medición, cada uno con lo que hace y su valor de fábrica
   * (ORIGEN_DEL_CIRCUITO, el mismo que pone la base al dar de alta). Los nombres
   * de campo son los que la ruta de siempre ya lee.
   */
  const ajustes: Ajuste[] = [
    {
      campo: "corredorEnRutaM",
      nombre: "Corredor de la ruta",
      queHace: "A cuántos metros del trazado un camión todavía cuenta como en la ruta: más lejos, ni se publica ni se mide.",
      unidad: "m",
      valor: circuito.corridorToleranceMeters,
      fabrica: ORIGEN_DEL_CIRCUITO.corredorEnRutaMetros,
    },
    {
      campo: "frescuraSeg",
      nombre: "Dato viejo",
      queHace: "Desde cuántos segundos sin posición una unidad se pinta apagada; es también el silencio de la jornada.",
      unidad: "s",
      valor: circuito.staleAfterSeconds,
      fabrica: ORIGEN_DEL_CIRCUITO.frescuraSegundos,
    },
    {
      campo: "confianzaMin",
      nombre: "Ventana de confianza",
      queHace: "Hasta cuántos minutos sin señal se sigue sosteniendo que la unidad va en la ruta.",
      unidad: "min",
      valor: circuito.serviceConfidenceMinutes,
      fabrica: ORIGEN_DEL_CIRCUITO.confianzaMinutos,
    },
    {
      campo: "velocidadKmh",
      nombre: "Velocidad del circuito",
      queHace: "Con la que Ontoy calcula en cuántos minutos llega el camión. Se calibra con la calle.",
      unidad: "km/h",
      valor: circuito.avgSpeedKmh,
      fabrica: ORIGEN_DEL_CIRCUITO.velocidadKmh,
      decimales: true,
    },
    {
      campo: "pisoRangoSeg",
      nombre: "Piso del tiempo estimado",
      queHace: "Lo mínimo que mide el rango de llegada que ve el pasajero, aunque el tráfico diga menos.",
      unidad: "s",
      valor: circuito.arrivalRangeFloorSeconds,
      fabrica: ORIGEN_DEL_CIRCUITO.pisoDelRangoSegundos,
    },
    {
      campo: "pegadoParadasM",
      nombre: "Pegado de paradas",
      queHace: "Al poner una parada en el mapa, desde cuántos metros del trazado se avisa que quedó lejos de su calle.",
      unidad: "m",
      valor: circuito.stopSnapToleranceMeters,
      fabrica: ORIGEN_DEL_CIRCUITO.pegadoDeParadasMetros,
    },
    {
      campo: "toleranciaLlegadaPct",
      nombre: "Tolerancia de llegada",
      queHace: "Qué tan ancha es la banda alrededor de la promesa: con 50 %, «cada 10 min» es EN RANGO de 5 a 15. Es contra lo que la torre dice adelantada o atrasada.",
      unidad: "%",
      valor: circuito.arrivalTolerancePct,
      fabrica: ORIGEN_DEL_CIRCUITO.toleranciaLlegadaPct,
      decimales: true,
    },
    {
      campo: "minutosFueraCorredor",
      nombre: "Minutos fuera del corredor",
      queHace: "Cuántos minutos seguidos lejos del trazado cuentan como salida en la jornada; menos que esto es el brinco del GPS.",
      unidad: "min",
      valor: circuito.corridorExitMinutes,
      fabrica: ORIGEN_DEL_CIRCUITO.minutosFueraDelCorredor,
    },
  ];

  /*
   * La historia de las reglas, con el nombre de pantalla de cada una. El nombre
   * de la columna viaja en el registro; aquí se dice como lo dice el formulario.
   */
  const NOMBRE_DE_REGLA: Record<string, string> = {
    corridor_tolerance_meters: "Corredor de la ruta (m)",
    stale_after_seconds: "Dato viejo (s)",
    service_confidence_minutes: "Ventana de confianza (min)",
    avg_speed_kmh: "Velocidad del circuito (km/h)",
    arrival_range_floor_seconds: "Piso del tiempo estimado (s)",
    stop_snap_tolerance_meters: "Pegado de paradas (m)",
    arrival_tolerance_pct: "Tolerancia de llegada (%)",
    corridor_exit_minutes: "Minutos fuera del corredor",
    service_start_local: "Abre a las",
    service_end_local: "Cierra a las",
    time_zone: "Zona horaria",
    service_launch_date: "Arranca el",
    arrival_range_enabled_at: "Tiempo estimado de llegada",
  };
  const cuandoDe = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", { timeZone: zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

  /* Los avisos al pasajero (0052): su estado ahora, y quién los capturó o retiró. */
  /*
   * Arriba lo que el pasajero ve o va a ver; abajo lo que ya no. Y la vigencia
   * dice la verdad de cada uno: un aviso retirado no dice «hasta que se retire».
   */
  const ORDEN = { en_ontoy: 0, programado: 1, termino: 2, retirado: 3 } as const;
  const avisosEnPantalla: AvisoEnPantalla[] = avisos
    .map((a) => ({ a, situacion: situacionDelAviso(a, new Date()) }))
    .sort((x, y) => ORDEN[x.situacion] - ORDEN[y.situacion] || y.a.capturadoEn.getTime() - x.a.capturadoEn.getTime())
    .map(({ a, situacion }) => ({
    id: a.id,
    titulo: a.titulo,
    detalle: a.detalle,
    situacion,
    vigencia: `${cuandoDe(a.vigenteDesde)} → ${
      a.retiradoEn ? `retirado ${cuandoDe(a.retiradoEn)}` : a.vigenteHasta ? cuandoDe(a.vigenteHasta) : "hasta que se retire"
    }`,
    capturado: `Capturado por ${quien(a.capturadoPor) ?? a.capturadoPor} · ${cuandoDe(a.capturadoEn)}`,
    retiro: a.retiradoEn ? `Retirado por ${quien(a.retiradoPor) ?? a.retiradoPor} · ${cuandoDe(a.retiradoEn)} · «${a.motivoRetiro}»` : null,
  }));

  const franjas: FranjaCapturada[] = (promesa?.bandas ?? []).map((b) => ({
    diaTipo: b.diaTipo,
    sentido: b.sentido,
    desdeLocal: b.desdeLocal,
    hastaLocal: b.hastaLocal,
    frequencyMinutes: b.frequencyMinutes,
  }));
  /*
   * Lo que Ontoy le dice al pasajero AHORA, con sus mismas dos funciones: la
   * promesa de este instante (`promesaAhora`) y su frase (`promesaEnPalabras`,
   * que vive en el dominio para que no haya dos). Sin sentido: la portada.
   */
  const ahora = new Date();
  const ontoyDice = promesaEnPalabras(promesaAhora(promesa ? franjas : null, ahora, zona), null);
  const horaAhora = new Intl.DateTimeFormat("es-MX", { timeZone: zona, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(ahora);
  const civil = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(d);
  const enPantalla = (a: (typeof asignaciones)[number]) => ({
    id: a.id,
    // Vigente: su jornada de hoy. Ya soltada: el día en que se soltó, el último que corrió aquí.
    jornada: `/casa/jstaff/circuitos/${id}/unidades/${a.unitId}${a.validTo ? `?fecha=${civil(a.validTo)}` : ""}`,
    unidad: a.unitLabel,
    transportista: a.carrierName,
    desde: dia(a.validFrom),
    hasta: a.validTo ? dia(a.validTo) : null,
    asignadaPor: quien(a.asignadaPor),
    cerradaPor: quien(a.cerradaPor),
    motivo: a.motivo,
  });

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA} lugar="/casa/jstaff/circuitos">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <Migas pasos={[{ nombre: "Circuitos", ruta: "/casa/jstaff/circuitos" }, { nombre: circuito.name }]} />
        <Titular nombre={`Ver ${circuito.name}`} bajo={`${concesion?.name ?? "concesión sin nombre"} · ${circuito.publicSlug}`} />

        {ok && (
          <p role="status" className={clases.aviso}>
            {ok}
          </p>
        )}
        {error && <AvisoDeError mensaje={error} />}

        <CadenaEnEslabones eslabones={cadena} />
        <p className={`text-[14px] ${minimo.listo ? "text-[var(--tenue)]" : ""}`}>{loQueFaltaEnPalabras(minimo)}</p>

        <Paso eslabon={eslabon(1)} titulo="Identidad">
          <IdentidadDelCircuito
            circuitId={id}
            nombre={circuito.name}
            slug={circuito.publicSlug}
            concesion={concesion?.name ?? "—"}
            color={circuito.colorHex.toUpperCase()}
            abre={circuito.serviceStartLocal.slice(0, 5)}
            cierra={circuito.serviceEndLocal.slice(0, 5)}
            zona={zona}
            arrancaEl={circuito.serviceLaunchDate}
            franjas={franjas}
          />
        </Paso>

        <Paso eslabon={eslabon(2)} titulo="Trazado">
          {(["ida", "vuelta"] as const).map((sentido) => {
            const t = trazados.find((x) => x.sentido === sentido);
            return (
              <Renglon key={sentido} pregunta={sentido === "ida" ? "Ida" : "Vuelta"} medida={Boolean(t)} tenue={!t}>
                {t
                  ? `${(t.lengthMeters / 1000).toFixed(1)} km · ${t.pointCount} puntos · ${t.sourceLayerName ?? "capa sin nombre"} · subido el ${dia(t.uploadedAt)}`
                  : "sin trazado"}
              </Renglon>
            );
          })}
          <p className="text-[13px] text-[var(--tenue)]">
            Se sube en el editor del mapa ·{" "}
            <a href="#editor" className="text-[var(--tinta)] underline underline-offset-2">
              ir al editor ↓
            </a>
          </p>
        </Paso>

        <Paso eslabon={eslabon(3)} titulo="Paradas">
          {paradas.length === 0 ? (
            <Vacio>Sin paradas capturadas</Vacio>
          ) : (
            <>
              <p className="text-[13px] text-[var(--tenue)]">
                <span data-medida>{porSentido("ida")}</span> de ida · <span data-medida>{porSentido("vuelta")}</span> de
                vuelta (las de «ambos» cuentan en los dos) ·{" "}
                {minimo.carriles.length === 0 ? "ningún sentido se puede medir todavía" : `se mide ${minimo.carriles.join(" y ")}`}
                {lejos > 0 && (
                  <span className="font-semibold text-[var(--tinta)]">
                    {" "}
                    · {lejos === 1 ? "1 parada lejos" : `${lejos} paradas lejos`} de su trazado
                  </span>
                )}
              </p>
              {medidas.map((m) => (
                <Renglon
                  key={m.stopId}
                  pregunta={`${m.nombre} · ${SENTIDO_EN_PALABRAS[m.sentido ?? "ambos"]}`}
                  medida
                >
                  {/* Lejos va en tinta y negrita, con su palabra: sin cobre (un aviso no es vida). */}
                  <span className={m.lejos ? "font-semibold" : "text-[var(--tenue)]"}>
                    {distanciasEnPalabras(m)}
                    {m.lejos ? ` · lejos, tolerancia ${circuito.stopSnapToleranceMeters} m` : ""} · {m.qr}
                  </span>
                </Renglon>
              ))}
            </>
          )}
          <p className="text-[13px] text-[var(--tenue)]">
            Se ponen, se corrige su sentido y se mueven —conservando su QR— en el editor del mapa ·{" "}
            <a href="#editor" className="text-[var(--tinta)] underline underline-offset-2">
              ir al editor ↓
            </a>
          </p>
        </Paso>

        <EditorDelMapa
          circuitoId={id}
          toleranciaMetros={circuito.stopSnapToleranceMeters}
          trazadosIniciales={trazados.map((t) => ({
            sentido: t.sentido as "ida" | "vuelta",
            coordinates: t.coordinates as Array<[number, number]>,
            pointCount: t.pointCount,
            lengthMeters: t.lengthMeters,
            sourceLayerName: t.sourceLayerName,
          }))}
          paradasIniciales={paradasConSentido.map((p) => ({
            stopId: p.stopId,
            qrSlug: p.qrSlug,
            name: p.name,
            orden: p.orden,
            latitude: p.latitude,
            longitude: p.longitude,
            sentido: p.sentido,
          }))}
        />

        <Paso eslabon={eslabon(4)} titulo="Promesa por franja">
          <PromesaDelCircuito
            circuitId={id}
            vigentes={franjas}
            hayVigente={promesa !== null}
            horario={{ abre: circuito.serviceStartLocal.slice(0, 5), cierra: circuito.serviceEndLocal.slice(0, 5) }}
          />
          {/*
           * Sin publicar, Ontoy no dice nada: la ruta no existe para el pasajero.
           * Decir «Ontoy dice…» de un circuito que nadie ve sería afirmar algo
           * que no ocurre (Marco §D); se dice lo que diría al publicarlo.
           */}
          <p className="text-[13px] text-[var(--tenue)]">
            {publicado ? (
              <>
                Ontoy ahorita (<span data-medida>{horaAhora}</span>) dice:{" "}
                <span className="text-[var(--tinta)]">«{ontoyDice}»</span>
              </>
            ) : (
              <>
                Ontoy no lo muestra: el circuito no está publicado. Publicado ahorita (<span data-medida>{horaAhora}</span>),
                diría: <span className="text-[var(--tinta)]">«{ontoyDice}»</span>
              </>
            )}{" "}
            — de la promesa guardada, no de lo que se está editando.
          </p>
          {versiones.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-dashed border-[var(--linea)] pt-2 text-[12.5px] text-[var(--tenue)]">
              {versiones.slice(0, 5).map((v) => (
                <span key={v.id}>
                  <span data-medida>{dia(v.validFrom)}</span>
                  {v.validTo ? <> → <span data-medida>{dia(v.validTo)}</span></> : " · vigente"} ·{" "}
                  {v.franjas === 1 ? "1 franja" : `${v.franjas} franjas`} ·{" "}
                  {v.capturadaPor ? `capturó ${quien(v.capturadaPor)}` : "sin registro de quién"}
                  {v.motivo ? ` · «${v.motivo}»` : ""}
                </span>
              ))}
            </div>
          )}
        </Paso>

        <Paso eslabon={eslabon(5)} titulo="Unidades asignadas">
          <UnidadesDelCircuito
            circuitId={id}
            vigentes={vigentes.map(enPantalla)}
            historia={soltadas.map(enPantalla)}
            asignables={asignables.map((u) => ({
              unitId: u.unitId,
              label: u.label,
              transportista: u.carrierName,
              ocupadaEn: u.ocupadaEnCircuitoId && u.ocupadaEnCircuitoId !== id ? u.ocupadaEnCircuito : null,
              ocupadaEnEste: u.ocupadaEnCircuitoId === id,
            }))}
          />
        </Paso>

        <Paso eslabon={eslabon(6)} titulo="Medición">
          {/* Una columna y no pregunta · respuesta: la lista de lo que falta no cabe a la derecha en celular. */}
          <div className="rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-2.5 text-[14px]">
            {minimo.listo ? (
              <span className="text-[var(--tenue)]">Tiene lo mínimo para medir: la torre puede medirlo.</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {minimo.faltan.map((f) => (
                  <li key={f.requisito}>{f.frase}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[13px]">
            <Link href={`/jstaff/circuitos/${id}/operar`} className="underline underline-offset-2">
              Ver la operación en la pantalla de siempre →
            </Link>
          </p>
          <AjustesDeMedicion circuitId={id} ajustes={ajustes} rangoEncendido={velocidadCalibrada(circuito)} />
          <HistoriaDeReglas
            cambios={reglasCambiadas.map((c) => ({
              id: c.id,
              regla: NOMBRE_DE_REGLA[c.regla] ?? c.regla,
              antes: c.valorAntes,
              despues: c.valorDespues,
              cuando: cuandoDe(c.cambiadoEn),
              quien: quien(c.cambiadoPor) ?? c.cambiadoPor,
              motivo: c.motivo,
            }))}
          />
        </Paso>

        <Paso eslabon={eslabon(7)} titulo="Publicar">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3.5">
            <span className="min-w-0 flex-1">
              <span
                className="block text-[16px]"
                style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}
              >
                {publicado ? "Publicado — ya lo ve alguien." : "Sin publicar — nadie lo ve todavía."}
              </span>
              <span className="mt-1 block text-[13px] text-[var(--tenue)]">
                {publicado
                  ? `Desde el ${dia(circuito.publishedAt!)} está en la app del pasajero. Despublicar lo quita al instante y no borra nada.`
                  : "Para la app del pasajero no existe. Publicar es decisión de quien opera: lo que falta arriba no cierra la puerta."}
              </span>
              <span data-medida className="mt-1.5 block text-[12.5px]">
                horario {horario} · {zona}
              </span>
            </span>
            <form action={`/api/jstaff/circuitos/${id}/publicacion`} method="post">
              <input type="hidden" name="publicar" value={publicado ? "no" : "si"} />
              <input type="hidden" name="volver" value={`/casa/jstaff/circuitos/${id}`} />
              <button type="submit" className={publicado ? clases.secundario : clases.primario}>
                {publicado ? "Despublicar" : "Publicar"}
              </button>
            </form>
          </div>
        </Paso>

        {/*
          Avisos al pasajero (8.13b; 0052). NO es un paso de la cadena: un
          circuito se publica sin avisos, y la cadena no los pide.
        */}
        <section id="avisos" aria-label="Avisos al pasajero" className="mt-6 flex scroll-mt-6 flex-col gap-2 border-t border-[var(--linea)] pt-5">
          <h2 className="text-[16px]" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}>
            Avisos al pasajero
          </h2>
          <p className="text-[13px] text-[var(--tenue)]">
            Lo que la concesión le dice al pasajero de esta ruta. En Ontoy se lee «según la concesión», con su fecha, en
            la campana. No se editan: si algo cambia, se retira con su motivo y se captura otro.
          </p>
          <AvisosDelCircuito circuitId={id} zona={zona} avisos={avisosEnPantalla} />
        </section>
      </div>
    </Marco>
  );
}

/** Un paso de la cadena: su número, su nombre y su estado — en tinta si pide algo. */
function Paso({ eslabon, titulo, children }: { eslabon: Eslabon; titulo: string; children: React.ReactNode }) {
  return (
    <section id={eslabon.ancla} aria-label={titulo} className="mt-3 flex scroll-mt-6 flex-col gap-2">
      <div className="flex items-baseline gap-2.5">
        <span data-medida className="text-[12px] text-[var(--tenue)]">
          {eslabon.paso}
        </span>
        <h2 className="text-[16px]" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}>
          {titulo}
        </h2>
        <span
          data-medida
          className={`ml-auto text-[10.5px] uppercase tracking-[0.14em] ${eslabon.pide ? "font-semibold text-[var(--tinta)]" : "text-[var(--tenue)]"}`}
        >
          {eslabon.resumen}
        </span>
      </div>
      {children}
    </section>
  );
}
