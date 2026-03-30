import Database from "better-sqlite3";
import path from "path";
import { logger } from "../lib/logger.js";

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || "./data/arthurbank.db";
    const resolvedPath = path.resolve(dbPath);

    db = new Database(resolvedPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");

    logger.info({ path: resolvedPath }, "Database connection established");
  }
  return db;
}

export function createDatabase(dbPath?: string): Database.Database {
  const instance = dbPath ? new Database(dbPath) : new Database(":memory:");
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.pragma("busy_timeout = 5000");
  return instance;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    logger.info("Database connection closed");
  }
}
