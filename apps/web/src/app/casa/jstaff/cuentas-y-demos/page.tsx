import { redirect } from "next/navigation";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { RAIZ_CATALOGO } from "@/lib/casa/regla";

/**
 * Cuentas y demos — hoy su único lugar construido es el catálogo de documentos.
 *
 * No dibuja una portada propia: una página que sólo liga a su único hijo sería
 * un cuarto vacío con un botón. Las altas y los demos entran aquí cuando se
 * muden del árbol viejo, y ese día esta página deja de redirigir.
 */
export default async function CuentasYDemos() {
  await exigirEnPagina({ tipo: "jstaff" });
  redirect(RAIZ_CATALOGO);
}
