import type { Metadata } from "next";
import "./validador.css";
import { Lector } from "@/components/validador/lector";

/**
 * **El lector del camión** — Ontoy 3.0 · PR P3.
 *
 * Ruta propia dentro de la app del pasajero y no una app aparte (ASAV,
 * 23-sep-2026): así hereda el service worker que ya sabe abrir sin red, no
 * estrena proyecto de despliegue, y el par —pase y lector— se puede probar con
 * dos teléfonos el mismo día. El aparato industrial es harina de otra sesión.
 *
 * **Cualquiera con la liga la abre.** En un laboratorio con boletos de mentira
 * eso no cuesta nada, y decirlo cuesta menos que descubrirlo: el día que esto
 * cobre, el lector no vive en la app del pasajero.
 *
 * No se indexa: una pantalla de operación no tiene nada que hacer en un
 * buscador.
 */
export const metadata: Metadata = {
  title: "Lector · R&D",
  robots: { index: false, follow: false },
};

export default function PaginaDelValidador() {
  return <Lector />;
}
