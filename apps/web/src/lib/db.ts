import { createDb, createRepositories, type Database, type Repositories } from "@jtel/db";

let db: Database | null = null;
let repos: Repositories | null = null;

export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING
  );
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getDb(): Database {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL no configurada. Conecta Neon en Vercel → Storage, o define DATABASE_URL en Environment Variables.",
    );
  }
  if (!db) {
    db = createDb(url);
  }
  return db;
}

export function getRepos(): Repositories {
  if (!repos) {
    repos = createRepositories(getDb());
  }
  return repos;
}
