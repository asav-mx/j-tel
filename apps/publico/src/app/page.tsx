import Link from "next/link";
import { redirect } from "next/navigation";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * El mismo nombre que titula la pestaña y nombra la app instalada
 * (`layout.tsx`). De variable de entorno y no del código: esta app sirve a
 * cualquier concesionario invitado, y hornear «Juárez Bus» convertiría el alta
 * del siguiente en un despliegue.
 */
const NOMBRE = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";

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
      {/*
        La portada no decía en qué app estaba parado el pasajero.
        Abría con «¿A dónde vas?» —una pregunta, sin sujeto—, y quien llega por
        una liga compartida no tiene forma de saber qué está abriendo.

        El nombre ya existía y ya salía del dato, no del código: la misma
        variable que titula la pestaña y nombra la app instalada. Lo que faltaba
        era decirlo en la página, que es el único lugar donde el pasajero mira.
      */}
      <p className="marca">{NOMBRE}</p>
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
