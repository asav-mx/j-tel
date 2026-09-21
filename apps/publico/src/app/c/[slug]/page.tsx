import { redirect } from "next/navigation";

/**
 * La dirección vieja de una ruta — **sigue sirviendo, y lleva a la nueva.**
 *
 * `/c/‹slug›` era la pantalla de una ruta cuando la app abría en un circuito.
 * Ontoy abre en la ciudad (8.8), así que esto ya no es una pantalla: es una
 * puerta que redirige al mapa con esa ruta enfocada.
 *
 * **No se borra, y ése es el punto.** Estas ligas están compartidas por
 * WhatsApp, impresas en papel y pegadas en postes. Una dirección que deja de
 * existir convierte cada una de esas copias en un callejón, que es justo lo que
 * la 8.10 prohíbe. Redirigir cuesta una línea; romperlas cuesta la confianza de
 * quien la compartió.
 */
export default async function RutaVieja({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/?ruta=${encodeURIComponent(slug)}`);
}
