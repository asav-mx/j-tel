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
import { useRutaEnVivo } from "@/lib/ontoy/ruta-en-vivo";
import { avanceSobreTrazado } from "@jtel/domain";

/**
 * El atajo de una parada guardada (8.8b) — con su próximo paso ya visible.
 *
 * Pide la ruta de ESA parada y nada más: por eso la guardada lleva su ruta
 * adentro. Un atajo que tuviera que barrer la ciudad para saber de qué ruta es
 * costaría toda la ciudad para enseñar un renglón.
 *
 * ## Lo medido y la promesa, separados (8.3)
 *
 * Arriba el rango, con el número económico de la unidad que viene —«viene la
 * 2120» es parte de la confianza (8.5)— y su edad. Abajo, en su propia línea,
 * la promesa publicada, **que se enseña siempre** (8.2).
 *
 * ## Cuando el dato no alcanza, la escalera (8.9)
 *
 * Sin permiso de rango no hay minuto, y entonces se dice qué sí se sabe: que la
 * ruta está cerrada y a qué hora abre, que no hay unidad a la vista, o que se
 * cayó la red. **Nunca se inventa una llegada**, y las tres frases son
 * distintas a propósito: son tres cosas distintas.
 */
export function AtajoDeParada({
  guardada,
  ruta,
  yo,
  alAbrir,
  alQuitar,
}: {
  guardada: ParadaGuardada;
  ruta: RutaDeLaCiudad | null;
  /**
   * Dónde está el pasajero, si ya dio permiso. Viene de la raíz de la app y no
   * se pide aquí: una tarjeta no pregunta por la ubicación (decisión del 22-sep),
   * y varias tarjetas no deben encender varias lecturas del GPS.
   */
  yo: { lat: number; lon: number } | null;
  alAbrir: () => void;
  alQuitar: () => void;
}) {
  const { forma, vivo, error, cargando } = useRutaEnVivo(guardada.ruta);
  const { velocidad, trazadoPorSentido } = useVelocidadDelCorredor(forma, vivo);

  const parada = forma?.paradas.find((p) => p.id === guardada.parada) ?? null;
  const color = ruta?.color_hex ?? forma?.color_hex ?? "currentColor";

  /*
   * El sentido de la parada. Una que sirve los dos se mide en «ida», que es el
   * sentido que la ruta nombra primero; la hoja del mapa deja escoger.
   */
  const sentido = parada?.sentido ?? "ida";
  const trazado = trazadoPorSentido.get(sentido);
  const abscisa = parada ? dondeCaeLaParada(parada, trazado, forma?.corredor_m ?? 0) : null;

  const llegadas =
    forma && vivo && abscisa !== null
      ? llegadasHasta(
          { avanceMetros: abscisa, sentido },
          { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
        )
      : [];
  const proxima = llegadas[0] ?? null;

  /*
   * 8.9b: sin minutos —velocidad sin calibrar, o sin permiso de rango—, la
   * cuenta de paradas, que sale de la posición real y de ninguna velocidad.
   * Con la ruta cerrada o sin arrancar no se cuenta nada: manda la escalera.
   */
  const enServicio = vivo !== null && vivo.estado !== "por_arrancar" && vivo.estado !== "fuera_de_horario";
  const porParadas =
    forma && vivo && enServicio && abscisa !== null
      ? paradasHastaLaParada({ avanceMetros: abscisa, sentido }, { forma, vivo, trazadoPorSentido })
      : [];
  const frescaEnParadas = porParadas.find((p) => p.fresca) ?? null;
  const viejaEnParadas = porParadas.find((p) => !p.fresca) ?? null;

  /* 8.3b: hasta DONDE ESTÁ EL PASAJERO, y sólo si está sobre el corredor. */
  const miAvance =
    yo && trazado && forma ? avanceSobreTrazado(yo, trazado, forma.corredor_m) : null;
  const hastaMi =
    forma && vivo && miAvance
      ? llegadasHasta(
          { avanceMetros: miAvance.avanceMetros, sentido },
          { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
        )[0] ?? null
      : null;

  return (
    <article className="ontoy-atajo" style={{ ["--ruta" as string]: color }}>
      <div className="ontoy-atajo-cabeza">
        <button type="button" className="ontoy-atajo-nombre" onClick={alAbrir}>
          {parada?.nombre ?? guardada.parada}
        </button>
        <button
          type="button"
          className="ontoy-estrella"
          onClick={alQuitar}
          aria-label={`Quitar ${parada?.nombre ?? "la parada"} de tus paradas`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
          </svg>
        </button>
      </div>
      <p className="ontoy-atajo-ruta">
        Ruta <b>{ruta?.nombre ?? forma?.nombre ?? "—"}</b>
        {parada?.sentido && <> · dirección <b>{parada.sentido}</b></>}
      </p>

      <div className="ontoy-atajo-eta">
        {proxima ? (
          <>
            <span className="ontoy-eta-num mono">{rangoEnPalabras(proxima.rango)}</span>
            <span className="ontoy-eta-apoyo">
              <span className="ontoy-punto-vivo" aria-hidden="true" />
              viene la <b>{proxima.unidad}</b> · {haceNMinutos(proxima.antiguedadSeg)}
            </span>
          </>
        ) : frescaEnParadas ? (
          <>
            <span className="ontoy-eta-num mono">{paradasEnPalabras(frescaEnParadas.paradas)}</span>
            <span className="ontoy-eta-apoyo">
              <span className="ontoy-punto-vivo" aria-hidden="true" />
              viene la <b>{frescaEnParadas.unidad}</b> · {haceNMinutos(frescaEnParadas.antiguedadSeg)}
            </span>
          </>
        ) : viejaEnParadas ? (
          /*
            El dato viejo se queda como dato viejo (8.9): en pasado, sin número
            grande y con su edad. Es lo último que se vio, no dónde está.
          */
          <span className="ontoy-eta-vieja">
            la <b>{viejaEnParadas.unidad}</b> iba {paradasEnPalabras(viejaEnParadas.paradas)}
            <span className="ontoy-eta-edad mono">
              <span className="ontoy-punto-viejo" aria-hidden="true" />
              posición de {haceNMinutos(viejaEnParadas.antiguedadSeg)}
            </span>
          </span>
        ) : (
          <span className="ontoy-eta-quieta">{sinLlegada({ cargando, error, vivo })}</span>
        )}
      </div>

      {hastaMi && (
        <>
          <div className="ontoy-atajo-tuyo">
            <span className="ontoy-et">Hasta donde estás</span>
            <b className="mono">{rangoEnPalabras(hastaMi.rango)}</b>
          </div>
          {/*
            El PARA QUÉ, donde se usa. La cara vieja lo decía y la nueva lo
            había perdido: la app pide la ubicación y el pasajero tiene derecho
            a saber para qué, en la pantalla donde se nota, no en un documento.
          */}
          <p className="ontoy-porque">Tu ubicación se usa para calcular cuándo llega tu camión.</p>
        </>
      )}

      <p className="ontoy-atajo-promesa">
        {/* La de ahora, del sentido de ESTA parada (las dos si sirve ambos): del vivo, o de la portada mientras llega. */}
        {promesaEnPalabras(vivo?.promesa ?? ruta?.promesa ?? null, parada?.sentido ?? null)}
      </p>
    </article>
  );
}

/**
 * La escalera en palabras (8.9). **Cada caso dice lo suyo**: una red caída, una
 * ruta cerrada y una ruta abierta sin camiones a la vista son tres cosas
 * distintas, y fundirlas en «no hay información» deja al pasajero sin saber si
 * esperar, irse, o volver a intentar.
 */
function sinLlegada(e: {
  cargando: boolean;
  error: boolean;
  vivo: { estado: string; abre_a: string; arranca_el: string | null } | null;
}): string {
  if (e.error) return "No pudimos preguntar ahorita";
  if (e.cargando || !e.vivo) return "Preguntando…";
  if (e.vivo.estado === "por_arrancar") {
    return e.vivo.arranca_el ? `Arranca el ${e.vivo.arranca_el}` : "Todavía no arranca";
  }
  if (e.vivo.estado === "fuera_de_horario") return `Fuera de horario · abre ${e.vivo.abre_a}`;
  return "Sin unidad a la vista ahorita";
}
