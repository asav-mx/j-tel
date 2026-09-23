"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LLAVE_DE_LABORATORIO } from "@jtel/domain/boleto";
import { desempacarPresentacion } from "@jtel/domain/boleto-empaque";
import {
  PALABRAS_DEL_MOTIVO,
  SEGUNDOS_ANTES_DE_DICTAR,
  TOPE_CODIGO_DICTADO,
  TOPE_SIN_SENAL,
  codigosDictados,
  porSincronizar,
  validadosHoy,
  validarCodigoDictado,
  validarPresentacion,
  type JornadaDelLector,
  type ResultadoDelLector,
} from "@jtel/domain/validador";
import { leerQr } from "@/lib/validador/leer-qr";
import { folioDelCodigoDictado } from "@/lib/validador/codigo-dictado";
import { detalleDeUnPaseBueno, tituloDeUnPaseBueno } from "@/lib/validador/palabras";
import { useJornadaDelLector, diaDeHoy } from "@/lib/validador/jornada-del-lector";
import { despertarElSonido, pip } from "@/lib/validador/pip";

/**
 * **El lector del camión** — Ontoy 3.0 · PR P3
 * (`docs/Ficha-Construccion-Ontoy-3-Pagos.md`).
 *
 * Un aparato, no una app. Verifica **sin internet**: la firma de J-Tel se
 * comprueba aquí mismo con la llave pública que el lector carga de antes, y de
 * la red no depende nada de lo que decide.
 *
 * ## Por qué esta pantalla no tiene piel clara
 *
 * **Excepción firmada por ASAV el 23-sep-2026.** La ley del skill dice que
 * ninguna pantalla se termina sin verse en las dos pieles; ésta se queda oscura
 * fija porque no es una pantalla que alguien abra, es **un instrumento de a
 * bordo**: nadie le pone modo claro al tablero de un camión. Por eso sus
 * colores viven en `validador.css` y no se tocan con `data-tema`.
 *
 * ## El pip y el verde salen de aquí
 *
 * Nunca del teléfono del pasajero. Un chofer que va manejando sólo oye, y una
 * grabación de un pip bastaría para engañarlo si el sonido saliera del aparato
 * equivocado. Ver `lib/validador/pip.ts`.
 *
 * ## La vía dictada está acotada por tres lados
 *
 * No prueba nada —ocho dígitos no traen firma— así que sólo se ofrece cuando la
 * cámara de verdad no pudo, lleva su propio tope del día, y queda **marcada**
 * para que se distinga al conciliar. Las reglas viven en `@jtel/domain/validador`.
 */

/** Cuánto se queda el veredicto en pantalla antes de volver a leer. */
const MS_DEL_VEREDICTO = 2600;
/** Cada cuánto se mira un cuadro de la cámara. */
const MS_ENTRE_CUADROS = 120;
/** A cuánto se encoge el cuadro antes de buscarle el código. */
const LADO_DEL_ANALISIS = 480;

type Fase = "apagado" | "leyendo" | "veredicto";

export function Lector() {
  const { jornada, guardar } = useJornadaDelLector();
  const [fase, setFase] = useState<Fase>("apagado");
  const [resultado, setResultado] = useState<ResultadoDelLector | null>(null);
  const [camaraFallo, setCamaraFallo] = useState<string | null>(null);
  const [segundosSinLeer, setSegundosSinLeer] = useState(0);
  const [senalSimuladaFuera, setSenalSimuladaFuera] = useState(false);
  const [enLinea, setEnLinea] = useState(true);
  const [teclado, setTeclado] = useState<string | null>(null);

  const video = useRef<HTMLVideoElement | null>(null);
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const jornadaViva = useRef<JornadaDelLector | null>(null);
  const faseViva = useRef<Fase>("apagado");
  const haySenalViva = useRef(true);

  const haySenal = enLinea && !senalSimuladaFuera;
  jornadaViva.current = jornada;
  faseViva.current = fase;
  haySenalViva.current = haySenal;

  useEffect(() => {
    setEnLinea(navigator.onLine);
    const cambio = () => setEnLinea(navigator.onLine);
    window.addEventListener("online", cambio);
    window.addEventListener("offline", cambio);
    return () => {
      window.removeEventListener("online", cambio);
      window.removeEventListener("offline", cambio);
    };
  }, []);

  const mostrar = useCallback(
    (nuevo: ResultadoDelLector, siguiente: JornadaDelLector) => {
      guardar(siguiente);
      setResultado(nuevo);
      setFase("veredicto");
      setSegundosSinLeer(0);
      pip(nuevo.pasa);
      setTimeout(() => setFase("leyendo"), MS_DEL_VEREDICTO);
    },
    [guardar],
  );

  /** Lo que se hace con el texto que salió de un QR. */
  const conLoLeido = useCallback(
    (texto: string) => {
      const actual = jornadaViva.current;
      if (!actual) return;
      const presentacion = desempacarPresentacion(texto);
      if (!presentacion) {
        /* Se leyó un QR, pero no es de un boleto: el código de una tienda, un
           volante. Se dice distinto de «no se pudo leer». */
        mostrar({ pasa: false, motivo: "cuerpo_mal_formado" }, actual);
        return;
      }
      const { resultado: veredicto, jornada: despues } = validarPresentacion(presentacion, {
        jornada: actual,
        llavePublicaDeJTel: LLAVE_DE_LABORATORIO.publica,
        ahora: Date.now(),
        haySenal: haySenalViva.current,
      });
      mostrar(veredicto, despues);
    },
    [mostrar],
  );

  const encender = useCallback(async () => {
    despertarElSonido();
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (video.current) {
        video.current.srcObject = flujo;
        await video.current.play();
      }
      setCamaraFallo(null);
      setFase("leyendo");
    } catch {
      /* Sin cámara el lector NO se apaga: se queda encendido con la vía dictada
         abierta de inmediato, porque aquí ya no hay nada que esperar. */
      setCamaraFallo("La cámara no encendió. Puedes teclear el código.");
      setFase("leyendo");
    }
  }, []);

  /* El reloj de los segundos sin leer: es lo que abre la vía dictada. */
  useEffect(() => {
    if (fase !== "leyendo" || camaraFallo) return;
    const reloj = setInterval(() => setSegundosSinLeer((s) => s + 1), 1000);
    return () => clearInterval(reloj);
  }, [fase, camaraFallo]);

  /* El barrido de cuadros. */
  useEffect(() => {
    if (fase === "apagado" || camaraFallo) return;
    const buscar = () => {
      if (faseViva.current !== "leyendo") return;
      const v = video.current;
      const c = lienzo.current;
      if (!v || !c || v.readyState < 2 || !v.videoWidth) return;
      const escala = Math.min(1, LADO_DEL_ANALISIS / Math.max(v.videoWidth, v.videoHeight));
      c.width = Math.round(v.videoWidth * escala);
      c.height = Math.round(v.videoHeight * escala);
      const pincel = c.getContext("2d", { willReadFrequently: true });
      if (!pincel) return;
      pincel.drawImage(v, 0, 0, c.width, c.height);
      const cuadro = pincel.getImageData(0, 0, c.width, c.height);
      const texto = leerQr(cuadro.data, c.width, c.height);
      if (texto) conLoLeido(texto);
    };
    const reloj = setInterval(buscar, MS_ENTRE_CUADROS);
    return () => clearInterval(reloj);
  }, [fase, camaraFallo, conLoLeido]);

  const puedeDictar = Boolean(camaraFallo) || segundosSinLeer >= SEGUNDOS_ANTES_DE_DICTAR;

  const mandarDictado = useCallback(() => {
    const actual = jornadaViva.current;
    if (!actual || teclado === null) return;
    const folio = folioDelCodigoDictado(teclado);
    if (!folio) return;
    const { resultado: veredicto, jornada: despues } = validarCodigoDictado(folio, {
      jornada: actual,
      ahora: Date.now(),
      haySenal: haySenalViva.current,
      laCamaraFallo: puedeDictar,
    });
    setTeclado(null);
    mostrar(veredicto, despues);
  }, [teclado, puedeDictar, mostrar]);

  if (!jornada) return <div className="val" aria-busy="true" />;

  const sinSenalHoy = porSincronizar(jornada);

  return (
    <div className="val">
      <p className="val-banda mono">
        R&amp;D interno · datos falsos · este lector no cobra dinero real
      </p>

      <header className="val-cabeza">
        <span className="val-aparato mono">{jornada.aparato} · PUERTA DELANTERA</span>
        <span className={`val-senal mono ${haySenal ? "" : "val-senal-fuera"}`}>
          <i aria-hidden="true" />
          {haySenal ? "CON SEÑAL" : "SIN SEÑAL"}
        </span>
      </header>

      <Semaforo fase={fase} resultado={resultado} />

      <div className="val-cuerpo">
        <p className="val-unidad mono">
          Unidad sin asignar · lector de laboratorio
        </p>

        <div className="val-camara">
          <video ref={video} className="val-video" playsInline muted />
          <canvas ref={lienzo} className="val-lienzo" />
          {fase === "apagado" && (
            <button type="button" className="val-encender" onClick={() => void encender()}>
              Encender el lector
            </button>
          )}
          {fase === "leyendo" && !camaraFallo && (
            <div className="val-mira" aria-hidden="true">
              Muestra el código del pase aquí
            </div>
          )}
          {camaraFallo && <p className="val-sin-camara">{camaraFallo}</p>}
        </div>

        <Panel fase={fase} resultado={resultado} />

        {teclado !== null && (
          <Teclado
            tecleado={teclado}
            alTeclear={setTeclado}
            alEnviar={mandarDictado}
            alCerrar={() => setTeclado(null)}
          />
        )}

        <div className="val-acciones">
          <button
            type="button"
            className="val-boton"
            disabled={!puedeDictar || fase === "apagado"}
            onClick={() => setTeclado("")}
          >
            Teclear código corto
          </button>
          <button
            type="button"
            className="val-boton"
            onClick={() => setSenalSimuladaFuera((x) => !x)}
          >
            {senalSimuladaFuera ? "Simular: volver la señal" : "Simular: quitar la señal"}
          </button>
        </div>

        {!puedeDictar && fase !== "apagado" && (
          <p className="val-pista">
            El código tecleado se abre si la cámara no puede: {SEGUNDOS_ANTES_DE_DICTAR} s
            intentando, o una cámara que no encendió.
          </p>
        )}

        <dl className="val-pie mono">
          <div>
            <dt>Validados hoy</dt>
            <dd>{validadosHoy(jornada)}</dd>
          </div>
          <div>
            <dt>Por sincronizar</dt>
            <dd>{sinSenalHoy}</dd>
          </div>
          <div>
            <dt>Sin señal</dt>
            <dd>
              {sinSenalHoy} de {TOPE_SIN_SENAL}
            </dd>
          </div>
          <div>
            <dt>Dictados</dt>
            <dd>
              {codigosDictados(jornada)} de {TOPE_CODIGO_DICTADO}
            </dd>
          </div>
        </dl>

        <p className="val-nota">
          Jornada del {diaDeHoy()}. Lo aceptado sin señal no le consta a ningún otro lector hasta
          que haya red: si un boleto pasó en dos camiones, salta al sincronizar — no antes.
        </p>
      </div>
    </div>
  );
}

function Semaforo({ fase, resultado }: { fase: Fase; resultado: ResultadoDelLector | null }) {
  const pasa = fase === "veredicto" && resultado?.pasa === true;
  const falla = fase === "veredicto" && resultado?.pasa === false;
  const clase = pasa ? "val-led-ok" : falla ? "val-led-mal" : fase === "leyendo" ? "val-led-lee" : "";
  const palabra = pasa ? "✓ SUBE" : falla ? "✕ NO PASA" : fase === "leyendo" ? "LEYENDO…" : "APAGADO";
  return (
    <p className={`val-led ${clase}`} role="status" aria-live="assertive">
      {palabra}
    </p>
  );
}

function Panel({ fase, resultado }: { fase: Fase; resultado: ResultadoDelLector | null }) {
  if (fase === "apagado") {
    return (
      <div className="val-panel">
        <p className="val-panel-titulo">Apagado.</p>
        <p className="val-panel-detalle">
          Enciéndelo para pedir la cámara. El lector verifica la firma de J-Tel aquí mismo, sin
          internet.
        </p>
      </div>
    );
  }
  if (fase !== "veredicto" || !resultado) {
    return (
      <div className="val-panel">
        <p className="val-panel-titulo">Listo.</p>
        <p className="val-panel-detalle">Esperando un pase.</p>
      </div>
    );
  }
  if (resultado.pasa) {
    return (
      <div className="val-panel val-panel-ok">
        <p className="val-panel-titulo">{tituloDeUnPaseBueno(resultado)}</p>
        <p className="val-panel-detalle">
          <span className="mono">{resultado.folio}</span> · {detalleDeUnPaseBueno(resultado)}
        </p>
      </div>
    );
  }
  return (
    <div className="val-panel val-panel-mal">
      <p className="val-panel-titulo">{PALABRAS_DEL_MOTIVO[resultado.motivo]}</p>
      <p className="val-panel-detalle">Cobra en efectivo, como siempre.</p>
    </div>
  );
}

function Teclado({
  tecleado,
  alTeclear,
  alEnviar,
  alCerrar,
}: {
  tecleado: string;
  alTeclear: (t: string) => void;
  alEnviar: () => void;
  alCerrar: () => void;
}) {
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", "ok"];
  const mostrado = tecleado.length
    ? tecleado.replace(/(\d{4})(\d+)/, "$1 $2")
    : "— — — —  — — — —";
  return (
    <div className="val-teclado">
      <p className="val-teclado-pantalla mono" aria-live="polite">
        {mostrado}
      </p>
      <div className="val-teclado-rejilla">
        {teclas.map((t) => (
          <button
            key={t}
            type="button"
            className="val-tecla mono"
            onClick={() => {
              if (t === "borrar") alTeclear(tecleado.slice(0, -1));
              else if (t === "ok") alEnviar();
              else if (tecleado.length < 8) alTeclear(tecleado + t);
            }}
            disabled={t === "ok" && tecleado.length !== 8}
          >
            {t === "borrar" ? "⌫" : t === "ok" ? "✓" : t}
          </button>
        ))}
      </div>
      <button type="button" className="val-boton" onClick={alCerrar}>
        Cerrar el teclado
      </button>
    </div>
  );
}
