import { createDb, createRepositories, type Database, type Repositories } from "@jtel/db";

let db: Database | null = null;
let repos: Repositories | null = null;

export function getDb(): Database {
  if (!db) {
    db = createDb(
      process.env.DATABASE_URL ?? "postgresql://jtel:jtel_dev@localhost:5432/jtel",
    );
  }
  return db;
}

export function getRepos(): Repositories {
  if (!repos) {
    repos = createRepositories(getDb());
  }
  return repos;
}
