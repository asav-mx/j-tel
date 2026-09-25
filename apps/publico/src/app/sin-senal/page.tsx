import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SinSenal } from "@/components/ontoy/sin-senal";
import { aDondeRegresar } from "@/lib/ontoy/sin-senal";

/**
 * **SIN SEÑAL**, la pantalla completa (3-ir-a/16) — lo que sale en lugar del
 * dinosaurio del navegador.
 *
 * Nadie llega aquí por una liga. La sirve `sw.js` **desde su caché** cuando una
 * página no abre sin red y no tiene copia guardada, con `?desde=‹la página›`
 * para saber a dónde regresar.
 *
 * ## Si esto lo arma el servidor, hay señal
 *
 * Y entonces no hay nada que decir: se regresa a donde iba. Pasa si alguien
 * recarga esta pantalla con la señal de vuelta — sin esto se quedaría leyendo
 * «Sin señal» con señal. Sin `desde` se dibuja la pantalla, que es justo lo que
 * pide el service worker al instalarse para guardarla.
 */
export const metadata: Metadata = {
  title: "Sin señal",
  robots: { index: false, follow: false },
};

export default async function PaginaSinSenal({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const desde = (await searchParams).desde;
  if (typeof desde === "string") redirect(aDondeRegresar(desde));
  return <SinSenal />;
}
