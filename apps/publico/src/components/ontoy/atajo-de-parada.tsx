"use client";

import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import {
  dondeCaeLaParada,
  llegadasHasta,
  paradasEnPalabras,
  paradasHastaLaParada,
  promesaEnPalabras,
  rangoEnPalabras,
  useVelocidadDelCorredor,
} from "@/lib/ontoy/llegadas";
import type { ParadaGuardada } from "@/lib/ontoy/paradas-guardadas";
import { useForma } from "@/lib/ontoy/ruta-en-vivo";
import type { Vivo } from "@/lib/ontoy/forma";
import { avanceSobreTrazado } from "@jtel/domain";
import { arranqueCorto, arranqueLargo } from "@/lib/fecha-arranque";
import { Ontoy, type PoseDeOntoy } from "@/components/ontoy/ontoy-muneco";

/**
 * Una parada guardada con su próximo paso (8.8b) — **en dos tamaños**.
 *
 * - **La tarjeta de «Tu próximo camión»** (`TarjetaDelProximoCamion`): la
 *   primera guardada, en la tarjeta carbón de arriba de Inicio, con **Ontoy
 *   diciendo la llegada** (ASAV, 25-sep). Es el Ontoy de la pantalla: uno.
 * - **El renglón** (`RenglonDeParada`): las demás, compactas, en «Tus paradas».
 *
 * Las dos leen **la misma lectura** (`useLecturaDeLaGuardada`): el dato es uno
 * y se dice en dos tamaños. Dos cálculos serían dos formas de dejar de
 * coincidir.
 *
 * ## Lo medido y la promesa, separados (8.3)
 *
 * Arriba lo medido, con el número económico de la unidad que viene —«viene la
 * 2120» es parte de la confianza (8.5)— y su edad. Abajo, en su propia línea,
 * la promesa publicada (8.2). **Una ruta por arrancar no promete frecuencia**:
 * todavía no pasa, y decir «cada 20 min» junto a «arranca el jueves» es
 * afirmar un servicio que no existe (la hoja ya lo cumplía desde el #569; aquí
 * se había escapado).
 *
 * ## Cuando el dato no alcanza, la escalera (8.9)
 *
 * Cada caso dice lo suyo —ruta cerrada, por arrancar, sin unidad a la vista,
 * red caída—, y **nunca se inventa una llegada**.
 *
 * ## La ruta se nombra, no se numera
 *
 * El diseño escribe «Tu 51 viene…» con una placa numerada. **Las rutas no
 * tienen número en la versión 1** —lo que numeró el #591 fueron paradas—, así
 * que la ruta va con **su nombre y su franja de color**, nunca con un número
 * inventado (ASAV, 25-sep). La placa con número queda para el día que la ruta
 * lo tenga de verdad en J-Staff.
 */

/** Lo que se sabe de la próxima llegada a una parada guardada, ya resuelto. */
export type Lectura =
  | { tipo: "rango"; rango: string; unidad: string; edadSeg: number }
  | { tipo: "paradas"; paradas: number; unidad: string; edadSeg: number }
  | { tipo: "vieja"; paradas: number; unidad: string; edadSeg: number }
  | { tipo: "cargando" }
  | { tipo: "sin-red" }
  | { tipo: "sin-ruta" }
  | { tipo: "por-arrancar"; arrancaEl: string | null }
  | { tipo: "fuera"; abreA: string }
  | { tipo: "sin-unidad" };

export function useLecturaDeLaGuardada({
  guardada,
  ruta,
  yo,
  vivo: vivoDeInicio,
  errorVivo,
}: {
  guardada: ParadaGuardada;
  ruta: RutaDeLaCiudad | null;
  /** Dónde está el pasajero, si ya dio permiso. No se pide aquí: una tarjeta no pregunta (22-sep). */
  yo: { lat: number; lon: number } | null;
  /**
   * Los camiones de SU ruta, de la consulta única de Inicio (`useEnVivo`).
   * `undefined` mientras llega la primera respuesta; `null` si ya llegó y esta
   * ruta no venía (dejó de publicarse).
   */
  vivo: Vivo | null | undefined;
  /** La consulta única falló: lo que se ve es lo último que se supo. */
  errorVivo: boolean;
}) {
  const { forma, error: errorForma, cargando: cargandoForma } = useForma(guardada.ruta);
  const vivo = vivoDeInicio ?? null;
  const error = errorForma || errorVivo;
  const cargando = cargandoForma || vivoDeInicio === undefined;
  const { velocidad, trazadoPorSentido } = useVelocidadDelCorredor(forma, vivo);

  const parada = forma?.paradas.find((p) => p.id === guardada.parada) ?? null;

  /* Una parada que sirve los dos sentidos se mide en «ida»; la hoja del mapa deja escoger. */
  const sentido = parada?.sentido ?? "ida";
  const trazado = trazadoPorSentido.get(sentido);
  const abscisa = parada ? dondeCaeLaParada(parada, trazado, forma?.corredor_m ?? 0) : null;

  const proxima =
    forma && vivo && abscisa !== null
      ? llegadasHasta(
          { avanceMetros: abscisa, sentido },
          { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
        )[0] ?? null
      : null;

  /*
   * 8.9b: sin minutos, la cuenta de paradas, que sale de la posición real y de
   * ninguna velocidad. Con la ruta cerrada o sin arrancar no se cuenta nada.
   */
  const enServicio = vivo !== null && vivo.estado !== "por_arrancar" && vivo.estado !== "fuera_de_horario";
  const porParadas =
    forma && vivo && enServicio && abscisa !== null
      ? paradasHastaLaParada({ avanceMetros: abscisa, sentido }, { forma, vivo, trazadoPorSentido })
      : [];
  const fresca = porParadas.find((p) => p.fresca) ?? null;
  const vieja = porParadas.find((p) => !p.fresca) ?? null;

  /* 8.3b: hasta DONDE ESTÁ EL PASAJERO, y sólo si está sobre el corredor. */
  const miAvance = yo && trazado && forma ? avanceSobreTrazado(yo, trazado, forma.corredor_m) : null;
  const hastaMi =
    forma && vivo && miAvance
      ? llegadasHasta(
          { avanceMetros: miAvance.avanceMetros, sentido },
          { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
        )[0] ?? null
      : null;

  const lectura: Lectura = proxima
    ? { tipo: "rango", rango: rangoEnPalabras(proxima.rango), unidad: proxima.unidad, edadSeg: proxima.antiguedadSeg }
    : fresca
      ? { tipo: "paradas", paradas: fresca.paradas, unidad: fresca.unidad, edadSeg: fresca.antiguedadSeg }
      : error
        ? { tipo: "sin-red" }
        : cargando
          ? { tipo: "cargando" }
          : !vivo
            ? { tipo: "sin-ruta" }
            : vivo.estado === "por_arrancar"
              ? { tipo: "por-arrancar", arrancaEl: vivo.arranca_el }
              : vivo.estado === "fuera_de_horario"
                ? { tipo: "fuera", abreA: vivo.abre_a }
                : vieja
                  ? { tipo: "vieja", paradas: vieja.paradas, unidad: vieja.unidad, edadSeg: vieja.antiguedadSeg }
                  : { tipo: "sin-unidad" };

  /*
   * La promesa de ahora, del sentido de ESTA parada: del vivo, o de la portada
   * mientras llega. **Por arrancar no se promete nada** (ver arriba).
   */
  const promesa =
    lectura.tipo === "por-arrancar"
      ? null
      : promesaEnPalabras(vivo?.promesa ?? ruta?.promesa ?? null, parada?.sentido ?? null) || null;

  return {
    nombreParada: parada?.nombre ?? null,
    nombreRuta: ruta?.nombre ?? forma?.nombre ?? "—",
    color: ruta?.color_hex ?? forma?.color_hex ?? "currentColor",
    sentidoDeLaParada: parada?.sentido ?? null,
    lectura,
    promesa,
    hastaMi: hastaMi ? rangoEnPalabras(hastaMi.rango) : null,
  };
}

/** Lo que Ontoy dice de una lectura: su pose, la frase grande y la de apoyo. */
export function dichoDeOntoy(
  l: Lectura,
  ruta: string,
): { pose: PoseDeOntoy; dicho: string; apoyo: string | null } {
  const edad = (s: number) => `posición de ${haceNMinutos(s)}`;
  switch (l.tipo) {
    case "rango":
      return { pose: "mirando-arriba", dicho: `Tu ${ruta} llega en ${l.rango}`, apoyo: `viene la ${l.unidad} · ${edad(l.edadSeg)}` };
    case "paradas":
      return {
        pose: "mirando-arriba",
        dicho: `Tu ${ruta} viene ${paradasEnPalabras(l.paradas)}`,
        apoyo: `viene la ${l.unidad} · ${edad(l.edadSeg)}`,
      };
    case "por-arrancar": {
      const cuando = arranqueLargo(l.arrancaEl ?? "");
      return { pose: "al-frente", dicho: cuando ? `Pronto salimos: ${cuando}` : "Pronto salimos", apoyo: null };
    }
    case "fuera":
      return { pose: "dormido", dicho: `Vuelven a las ${l.abreA}`, apoyo: "Fuera de horario. Todavía no sale ninguna unidad." };
    case "vieja":
      return {
        pose: "dormido",
        dicho: `No veo tu ${ruta} ahorita`,
        apoyo: `No te invento una hora. Lo último que supe: la ${l.unidad} iba ${paradasEnPalabras(l.paradas)}, ${edad(l.edadSeg)}.`,
      };
    case "sin-unidad":
      return { pose: "dormido", dicho: `No veo tu ${ruta} ahorita`, apoyo: "No te invento una hora." };
    case "sin-red":
      return { pose: "sin-red", dicho: "Sin señal", apoyo: "No pudimos preguntar ahorita." };
    case "cargando":
      return { pose: "sin-dato", dicho: "Preguntando…", apoyo: null };
    case "sin-ruta":
      return { pose: "sin-dato", dicho: "Sin datos de esta ruta ahorita", apoyo: null };
  }
}

/** Lo que dice el renglón compacto, a la derecha: corto, y con su edad cuando es medido. */
export function dichoDelRenglon(l: Lectura): { grande: string | null; chico: string } {
  switch (l.tipo) {
    case "rango":
      return { grande: l.rango, chico: `la ${l.unidad} · ${haceNMinutos(l.edadSeg)}` };
    case "paradas":
      return { grande: `${l.paradas} ${l.paradas === 1 ? "parada" : "paradas"}`, chico: `la ${l.unidad} · ${haceNMinutos(l.edadSeg)}` };
    case "vieja":
      return { grande: null, chico: `la ${l.unidad} iba ${paradasEnPalabras(l.paradas)} · ${haceNMinutos(l.edadSeg)}` };
    case "por-arrancar": {
      const cuando = arranqueCorto(l.arrancaEl ?? "");
      return { grande: null, chico: cuando ? `arranca el ${cuando}` : "todavía no arranca" };
    }
    case "fuera":
      return { grande: null, chico: `abre a las ${l.abreA}` };
    case "sin-unidad":
      return { grande: null, chico: "sin unidad a la vista" };
    case "sin-red":
      return { grande: null, chico: "sin señal" };
    case "cargando":
      return { grande: null, chico: "Preguntando…" };
    case "sin-ruta":
      return { grande: null, chico: "sin datos ahorita" };
  }
}

type PropsDeLaGuardada = Parameters<typeof useLecturaDeLaGuardada>[0] & { alAbrir: () => void };

/**
 * **«Tu próximo camión»**: la tarjeta carbón de arriba de Inicio, con Ontoy
 * diciendo la llegada de la primera guardada (ASAV, 25-sep). Una por pantalla,
 * como el botón principal.
 */
export function TarjetaDelProximoCamion({
  alQuitar,
  ...props
}: PropsDeLaGuardada & { alQuitar: () => void }) {
  const g = useLecturaDeLaGuardada(props);
  const { pose, dicho, apoyo } = dichoDeOntoy(g.lectura, g.nombreRuta);
  const nombre = g.nombreParada ?? props.guardada.parada;

  return (
    <article className="ontoy-proximo" style={{ ["--ruta" as string]: g.color }}>
      <div className="ontoy-proximo-cabeza">
        <button type="button" className="ontoy-proximo-parada" onClick={props.alAbrir}>
          <span className="ontoy-proximo-nombre">{nombre}</span>
          {/* El color es identidad y NUNCA va solo: el nombre de la ruta lo acompaña (8.8c). */}
          <span className="ontoy-proximo-ruta">
            <span className="ontoy-franja" aria-hidden="true" />
            Ruta {g.nombreRuta}
            {g.sentidoDeLaParada && <> · dirección {g.sentidoDeLaParada}</>}
          </span>
        </button>
        <button
          type="button"
          className="ontoy-estrella"
          onClick={alQuitar}
          aria-label={`Quitar ${nombre} de tus paradas`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
          </svg>
        </button>
      </div>

      <div className="ontoy-proximo-dicho" aria-live="polite">
        <Ontoy pose={pose} tamano={72} />
        <div>
          <p className="ontoy-proximo-frase">{dicho}</p>
          {apoyo && <p className="ontoy-proximo-apoyo cifra">{apoyo}</p>}
        </div>
      </div>

      {g.hastaMi && (
        <>
          <p className="ontoy-proximo-tuyo">
            Hasta donde estás: <b className="cifra">{g.hastaMi}</b>
          </p>
          {/* El PARA QUÉ, donde se usa: la pantalla donde se nota, no un documento. */}
          <p className="ontoy-porque">Tu ubicación se usa para calcular cuándo llega tu camión.</p>
        </>
      )}

      {g.promesa && <p className="ontoy-proximo-promesa">{g.promesa}</p>}
    </article>
  );
}

/** Una guardada en renglón compacto: franja · nombre · ruta · lo que se sabe · ›. */
export function RenglonDeParada(props: PropsDeLaGuardada) {
  const g = useLecturaDeLaGuardada(props);
  const { grande, chico } = dichoDelRenglon(g.lectura);
  return (
    <button type="button" className="ontoy-renglon" onClick={props.alAbrir} style={{ ["--ruta" as string]: g.color }}>
      <span className="ontoy-franja-vertical" aria-hidden="true" />
      <span className="ontoy-renglon-texto">
        <span className="ontoy-renglon-titulo">{g.nombreParada ?? props.guardada.parada}</span>
        <span className="ontoy-renglon-sub">Ruta {g.nombreRuta}</span>
      </span>
      <span className="ontoy-renglon-dato cifra">
        {grande && <b>{grande}</b>}
        <span>{chico}</span>
      </span>
      <svg className="ontoy-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}
