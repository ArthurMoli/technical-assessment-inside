import type Database from "better-sqlite3";
import { up as initialMigration } from "./migrations/001_initial.js";
import { logger } from "../lib/logger.js";

export function runMigrations(db: Database.Database): void {
  logger.info("Running database migrations...");
  initialMigration(db);
  logger.info("Migrations completed successfully");
}
