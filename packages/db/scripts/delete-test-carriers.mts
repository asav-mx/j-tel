import { existsSync } from "node:fs";
for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    process.loadEnvFile(p);
    break;
  }
}
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL!);
const deleted = await sql`
  delete from accounts
  where slug in ('Carrier test', 'Carrier test 1')
  returning name, slug
`;
for (const r of deleted) console.log(`Eliminada: ${r.name} (${r.slug})`);
if (deleted.length === 0) console.log("No había cuentas de prueba que borrar.");
await sql.end();
