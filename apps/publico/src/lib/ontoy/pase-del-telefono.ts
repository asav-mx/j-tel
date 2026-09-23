"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LLAVE_DE_LABORATORIO,
  crearPortador,
  emitirBoleto,
  presentarBoleto,
  type Presentacion,
} from "@jtel/domain/boleto";
import { empacarPresentacion } from "@jtel/domain/boleto-empaque";
import {
  PASE_VACIO,
  agregarCompra,
  boletoParaMostrar,
  confirmarQuemados,
  foliosPorConfirmar,
  marcarMostrado,
  type BoletoDelTelefono,
  type Pase,
} from "./pase";

/**
 * El pase vive **en el teléfono**, como las paradas guardadas (8.7, 8.8b).
 *
 * Mismo trato que `paradas-guardadas.ts`, y por las mismas razones: cada lectura
 * y cada escritura en `try/catch` porque `localStorage` **lanza** en una ventana
 * privada de Safari; el estado arranca vacío y se llena al montar, porque el
 * servidor no tiene `localStorage` y leerlo en el primer dibujo daría un HTML
 * distinto del que el navegador arma después.
 *
 * ## Lo que aquí es de mentira, dicho sin rodeos
 *
 * **El teléfono se emite sus propios boletos, con la llave de laboratorio.** En
 * la vida real quien los firma es J-Tel, de su lado, y la llave privada nunca
 * baja a un celular. Aquí baja porque toda la ficha es un laboratorio con datos
 * falsos y porque no hay servidor que los emita todavía.
 *
 * Que eso sea visible es parte del punto: un teléfono que puede firmar sus
 * propios boletos puede fabricarse viajes gratis, y por eso **este código no
 * puede acercarse a dinero real** — que es exactamente lo que dice la raya de
 * la ficha, y lo que la valla anti-cobro vigila.
 *
 * ## Una pregunta que este PR no contesta
 *
 * El dominio pide una `ruta` dentro del boleto. **A qué se ata un viaje —a un
 * circuito, a una concesión o a todo el sistema— no lo dice la ficha**, y no es
 * del P2 decidirlo: un pasajero que compra diez viajes no escoge diez rutas.
 * Mientras tanto se emiten con `cualquier-circuito`, que es lo único que no
 * afirma de más. Lo decide el P4, cuando el reparto a transportistas diga qué
 * necesita saber cada boleto.
 */

const LLAVE = "ontoy:pase";
const RUTA_DEL_LABORATORIO = "cualquier-circuito";
const DIAS_DE_VIGENCIA = 90;

interface PaseGuardado {
  boletos: BoletoDelTelefono[];
  movimientos: Pase["movimientos"];
  cuenta: string | null;
}

function leer(): Pase {
  try {
    const crudo = window.localStorage.getItem(LLAVE);
    if (!crudo) return PASE_VACIO;
    const valor = JSON.parse(crudo) as PaseGuardado;
    if (!Array.isArray(valor?.boletos) || !Array.isArray(valor?.movimientos)) return PASE_VACIO;
    return {
      boletos: valor.boletos,
      movimientos: valor.movimientos,
      cuenta: typeof valor.cuenta === "string" ? valor.cuenta : null,
    };
  } catch {
    return PASE_VACIO;
  }
}

function escribir(pase: Pase): void {
  try {
    window.localStorage.setItem(LLAVE, JSON.stringify(pase));
  } catch {
    /* Sin dónde guardar, la app sigue: se pierde el pase, no la pantalla. */
  }
}

/** Un folio legible y dictable: ocho dígitos, con su prefijo para la pantalla. */
function folioNuevo(): string {
  const n = Math.floor(Math.random() * 100_000_000);
  return `ONT-${String(n).padStart(8, "0")}`;
}

function emitirEnElTelefono(ahora: number): BoletoDelTelefono {
  const portador = crearPortador();
  const sellado = emitirBoleto(
    {
      folio: folioNuevo(),
      ruta: RUTA_DEL_LABORATORIO,
      emitido: ahora,
      vence: ahora + DIAS_DE_VIGENCIA * 24 * 60 * 60 * 1000,
      portador: portador.publica,
    },
    LLAVE_DE_LABORATORIO,
  );
  return {
    sellado,
    portadorPrivada: [...portador.privada].map((b) => b.toString(16).padStart(2, "0")).join(""),
    estado: "sin_usar",
  };
}

const deHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{2}/g)?.map((p) => parseInt(p, 16)) ?? []);

/** Lo que va dentro del QR ahora mismo, ya empacado. */
export function textoDelQr(boleto: BoletoDelTelefono, ahora: number): string {
  const presentacion: Presentacion = presentarBoleto(
    boleto.sellado,
    { privada: deHex(boleto.portadorPrivada), publica: deHex(boleto.sellado.cuerpo.portador) },
    ahora,
  );
  return empacarPresentacion(presentacion);
}

export function useElPase() {
  const [pase, setPase] = useState<Pase>(PASE_VACIO);
  /** `false` no es «no tienes viajes»: es «aquí no se puede guardar». */
  const [disponible, setDisponible] = useState(true);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.getItem(LLAVE);
      setPase(leer());
    } catch {
      setDisponible(false);
    }
    setListo(true);
  }, []);

  const guardar = useCallback((siguiente: Pase) => {
    escribir(siguiente);
    setPase(siguiente);
    return siguiente;
  }, []);

  const comprar = useCallback(
    (viajes: number) => {
      const ahora = Date.now();
      const nuevos = Array.from({ length: viajes }, () => emitirEnElTelefono(ahora));
      guardar(agregarCompra(pase, nuevos, ahora));
    },
    [pase, guardar],
  );

  /** Toma el boleto que toca y lo deja enseñado, por confirmar. */
  const mostrar = useCallback((): BoletoDelTelefono | null => {
    const boleto = boletoParaMostrar(pase);
    if (!boleto) return null;
    if (boleto.estado === "sin_usar") {
      guardar(marcarMostrado(pase, boleto.sellado.cuerpo.folio, Date.now()));
    }
    return boleto;
  }, [pase, guardar]);

  const alternarCuenta = useCallback(() => {
    guardar({ ...pase, cuenta: pase.cuenta ? null : "m···@gmail.com" });
  }, [pase, guardar]);

  return { pase, disponible, listo, comprar, mostrar, alternarCuenta, guardar };
}

/**
 * **El cierre del ciclo** — Ontoy 3.0 · PR P3.5.
 *
 * Cuando hay señal, el pase pregunta por los boletos que enseñó y nadie le
 * confirmó. Los que el lector ya entregó pasan a `confirmado`, su renglón deja
 * de decir «sin confirmar», y el siguiente viaje queda listo para mostrarse.
 *
 * ## Lo que se pregunta, y cada cuánto
 *
 * **Sólo los folios en uso** (decisión de Asav, e1) y **sólo cuando hay
 * alguno**: un pase sin nada en el aire no le pregunta nada a nadie. Se
 * insiste cada {@link CADA_CUANTO_PREGUNTA_MS} porque del otro lado falta un
 * paso más —que el lector sincronice—, y eso puede tardar lo que tarde el
 * camión en salir del túnel.
 *
 * ## Lo que NO se hace si el servidor no contesta
 *
 * Nada. El boleto se queda «sin confirmar», que es lo único que se puede
 * afirmar: que no haya red no es prueba de que no te dejaron subir.
 */
export const CADA_CUANTO_PREGUNTA_MS = 20_000;

export function useConfirmacionDelPase(args: {
  pase: Pase;
  listo: boolean;
  guardar: (p: Pase) => Pase;
}) {
  const { pase, listo, guardar } = args;
  const paseVivo = useRef(pase);
  paseVivo.current = pase;

  const preguntar = useCallback(async () => {
    const actual = paseVivo.current;
    const folios = foliosPorConfirmar(actual);
    if (folios.length === 0) return;
    try {
      const r = await fetch("/api/boletos/estado", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folios }),
      });
      if (!r.ok) return;
      const dicho = (await r.json()) as { quemados?: string[] };
      if (!Array.isArray(dicho?.quemados) || dicho.quemados.length === 0) return;
      const siguiente = confirmarQuemados(paseVivo.current, dicho.quemados);
      if (siguiente !== paseVivo.current) guardar(siguiente);
    } catch {
      /* Sin red, el pase sigue diciendo que no sabe. */
    }
  }, [guardar]);

  useEffect(() => {
    if (!listo) return;
    if (foliosPorConfirmar(pase).length === 0) return;
    void preguntar();
    const reloj = setInterval(() => void preguntar(), CADA_CUANTO_PREGUNTA_MS);
    const alVolverLaSenal = () => void preguntar();
    window.addEventListener("online", alVolverLaSenal);
    return () => {
      clearInterval(reloj);
      window.removeEventListener("online", alVolverLaSenal);
    };
    /* `pase` entra en las dependencias sólo por su cuenta de pendientes: lo que
       importa es empezar a preguntar cuando aparece el primero y dejar de
       hacerlo cuando se acaba el último. */
  }, [listo, pase, preguntar]);
}
