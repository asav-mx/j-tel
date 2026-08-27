import Link from "next/link";
import { redirect } from "next/navigation";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * La puerta.
 *
 * Con un solo circuito publicado entra directo: un pasajero que abre la app no
 * debería tener que escoger de una lista de uno. Con varios, los lista. Ningún
 * nombre en el código — salen de la base.
 */
export default async function Inicio() {
  const circuitos = await getRepos().circuits.listPublishedCircuits();

  if (circuitos.length === 1) redirect(`/c/${circuitos[0].publicSlug}`);

  return (
    <main className="puerta">
      <h1>¿A dónde vas?</h1>
      <p>{circuitos.length === 0 ? "Todavía no hay rutas publicadas." : "Escoge tu ruta."}</p>
      {circuitos.length > 0 && (
        <ul>
          {circuitos.map((c) => (
            <li key={c.publicSlug}>
              <Link href={`/c/${c.publicSlug}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
