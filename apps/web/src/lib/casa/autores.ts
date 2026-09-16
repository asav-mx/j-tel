import { CLERK_CONFIGURADO } from "@/lib/clerk-estado";

/**
 * Quién escribió cada versión, en palabras que se leen: el correo de su sesión.
 *
 * Las fojas y las reglas guardan el id de Clerk (`user_2x…`) como autor, que es
 * lo estable. Mostrarlo tal cual es ilegible; decidido por ASAV el 16 de
 * septiembre de 2026: en pantalla va el correo, leído de Clerk en el servidor.
 *
 * **Nunca se inventa un nombre.** Si Clerk no está configurado, si el id no es
 * de Clerk (las identidades de desarrollo) o si la consulta falla, se muestra el
 * id tal como quedó guardado: feo, pero verdadero. Un adorno —y esto lo es— no
 * puede tumbar la pantalla que lo hospeda.
 */
export async function correosDeAutores(ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const legibles = new Map<string, string>();
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  for (const id of unicos) legibles.set(id, id);

  const deClerk = unicos.filter((id) => id.startsWith("user_"));
  if (!CLERK_CONFIGURADO || deClerk.length === 0) return legibles;

  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const cliente = await clerkClient();
    const { data } = await cliente.users.getUserList({ userId: deClerk, limit: deClerk.length });
    for (const usuario of data) {
      const principal = usuario.emailAddresses.find((e) => e.id === usuario.primaryEmailAddressId);
      const correo = principal?.emailAddress ?? usuario.emailAddresses[0]?.emailAddress;
      if (correo) legibles.set(usuario.id, correo);
    }
  } catch {
    // Se queda con los ids: ver arriba.
  }
  return legibles;
}
