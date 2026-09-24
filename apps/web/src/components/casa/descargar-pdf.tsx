"use client";

/**
 * **Descargar el PDF de lo que esta pantalla está enseñando.**
 *
 * Abre el diálogo de impresión del navegador, donde se escoge «Guardar como
 * PDF». El rótulo del botón dice «Descargar PDF» y el texto de al lado dice
 * exactamente eso, porque un botón que promete un archivo y abre un diálogo sin
 * avisar es una promesa a medias.
 *
 * ## Por qué el PDF lo hace el navegador y no el servidor
 *
 * Porque **el que hace el navegador es el bueno**, y está medido: una parada da
 * **1 página** tamaño carta, las 17 de Oasis–Centro dan **17**, todo vectorial,
 * con la letra de la marca incrustada, y el código del PDF **se lee con un
 * lector** (comprobado recortándolo del PDF y pasándolo por jsQR).
 *
 * Un botón que descargue el archivo sin pasar por el diálogo necesita dibujar el
 * PDF **en el servidor**, y las dos formas de hacerlo cuestan:
 *
 *  - Un navegador headless en la función: es el mismo PDF, pero es una
 *    dependencia grande, una función lenta y otra pieza que mantener.
 *  - Dibujar el PDF a mano: sale un archivo más limpio, y a cambio hay **dos
 *    dibujantes del mismo objeto físico**. Los dos se separan con el tiempo, y
 *    éste es el objeto que no se puede corregir después de atornillarlo.
 *
 * Así que el diálogo, hasta que Asav diga otra cosa.
 */
export function DescargarPdf({ que }: { que: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[var(--tinta)] bg-[var(--tinta)] px-4 py-2.5 text-[14px] font-semibold text-[var(--papel)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
    >
      Descargar PDF {que}
    </button>
  );
}
