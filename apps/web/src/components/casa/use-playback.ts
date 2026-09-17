"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { incluyeAhora, velocidadAuto, type Pedazo, type Periodo } from "@/lib/casa/recorrido";

/** Por qué está detenido el playback: entre dos pedazos, al final, o al alcanzar el ahora. */
export type Alto = null | { tipo: "pausa"; indice: number } | { tipo: "fin" } | { tipo: "ahora" };

/**
 * El reloj del playback de Recorridos (C3), compartido por Ver ‹unidad› y Ver
 * ‹dispositivo›: las dos pantallas se detienen en los mismos lugares y con las
 * mismas teclas, aunque digan cosas distintas al detenerse.
 *
 * Recorre sólo lo medido: al terminar un pedazo se detiene (`alto`), y quien
 * mira decide continuar. Qué se dice en esa pausa es de cada pantalla.
 */
export function usePlayback(pedazos: Pedazo[], periodo: Periodo, leida: number) {
  const [seg, setSeg] = useState(0);
  const [t, setTEstado] = useState(0);
  /** El instante del playback, compartido entre el bucle de cuadros y la cinta: el render llega tarde. */
  const tRef = useRef(0);
  const setT = useCallback((v: number) => {
    tRef.current = v;
    setTEstado(v);
  }, []);
  const [tocando, setTocando] = useState(false);
  const [alto, setAlto] = useState<Alto>(null);
  const [velManual, setVelManual] = useState<number | null>(null);
  const velAuto = useMemo(() => velocidadAuto(pedazos), [pedazos]);
  const multiplicador = velManual ?? velAuto;

  const estado = useRef({ seg, multiplicador, pedazos, periodo, leida });
  estado.current = { seg, multiplicador, pedazos, periodo, leida };

  // Cambiar de periodo regresa todo al principio y la velocidad a auto.
  useEffect(() => {
    setSeg(0);
    setT(pedazos[0]?.t0 ?? 0);
    setTocando(false);
    setAlto(null);
    setVelManual(null);
  }, [pedazos, setT]);

  useEffect(() => {
    if (!tocando) return;
    let cuadro = 0;
    let previo: number | null = null;
    const paso = (ahora: number) => {
      const e = estado.current;
      const dt = previo === null ? 0 : (ahora - previo) * e.multiplicador;
      previo = ahora;
      const pedazo = e.pedazos[e.seg];
      if (!pedazo) return;
      const siguiente = tRef.current + dt;
      if (siguiente >= pedazo.t1) {
        setT(pedazo.t1);
        setTocando(false);
        if (e.seg < e.pedazos.length - 1) setAlto({ tipo: "pausa", indice: e.seg });
        else setAlto(incluyeAhora(e.periodo, e.leida) ? { tipo: "ahora" } : { tipo: "fin" });
        return;
      }
      setT(siguiente);
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [tocando, setT]);

  const reiniciar = useCallback(() => {
    setAlto(null);
    setSeg(0);
    setT(estado.current.pedazos[0]?.t0 ?? 0);
  }, [setT]);

  const continuar = useCallback(() => {
    const e = estado.current;
    const sig = e.seg + 1;
    if (!e.pedazos[sig]) return;
    setAlto(null);
    setSeg(sig);
    setT(e.pedazos[sig]!.t0);
    setTocando(true);
  }, [setT]);

  const tocar = useCallback(() => {
    if (pedazos.length === 0) return;
    if (tocando) {
      setTocando(false);
      return;
    }
    if (alto?.tipo === "pausa") return continuar();
    if (alto?.tipo === "fin" || alto?.tipo === "ahora") reiniciar();
    setTocando(true);
  }, [pedazos.length, tocando, alto, continuar, reiniciar]);

  const buscar = useCallback(
    (i: number, instante: number) => {
      const p = estado.current.pedazos[i];
      if (!p) return;
      setAlto(null);
      setSeg(i);
      setT(Math.min(Math.max(instante, p.t0), p.t1));
    },
    [setT],
  );

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const destino = (ev.target as HTMLElement | null)?.tagName;
      if (ev.code === "Space" && destino !== "BUTTON" && destino !== "INPUT" && destino !== "A") {
        ev.preventDefault();
        tocar();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [tocar]);

  const textoPlay = tocando
    ? "Pausa"
    : alto?.tipo === "fin" || alto?.tipo === "ahora"
      ? "Volver a empezar"
      : alto?.tipo === "pausa"
        ? "Continuar"
        : "Reproducir";

  return { seg, t, tocando, alto, velManual, setVelManual, velAuto, tocar, continuar, reiniciar, buscar, textoPlay };
}
