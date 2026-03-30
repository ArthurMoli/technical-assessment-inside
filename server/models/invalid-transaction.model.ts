import type Database from "better-sqlite3";
import type { InvalidTransactionRow } from "../types/index.js";

export function insert(
  db: Database.Database,
  data: { original_id: string | null; raw_data: string; error_reason: string }
): void {
  db.prepare(
    "INSERT INTO invalid_transactions (original_id, raw_data, error_reason) VALUES (?, ?, ?)"
  ).run(data.original_id, data.raw_data, data.error_reason);
}

export function findAll(
  db: Database.Database,
  opts: { limit: number; offset: number }
): InvalidTransactionRow[] {
  return db
    .prepare("SELECT * FROM invalid_transactions ORDER BY received_at DESC LIMIT ? OFFSET ?")
    .all(opts.limit, opts.offset) as InvalidTransactionRow[];
}

export function countAll(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM invalid_transactions")
    .get() as { count: number };
  return row.count;
}
