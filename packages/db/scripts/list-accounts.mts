import { existsSync } from "node:fs";
for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    process.loadEnvFile(p);
    break;
  }
}
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL!);
const rows =
  await sql`select name, slug, type, is_demo, created_at from accounts order by created_at`;
for (const r of rows)
  console.log(
    `${String(r.type).padEnd(8)} ${String(r.slug).padEnd(25)} ${r.name} (demo=${r.is_demo}) ${r.created_at.toISOString()}`,
  );
await sql.end();
