import type Database from "better-sqlite3";
import type { TransactionRow } from "../types/index.js";

export function findById(db: Database.Database, id: string): TransactionRow | undefined {
  return db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as TransactionRow | undefined;
}

export function insert(
  db: Database.Database,
  tx: Omit<TransactionRow, "processed_at" | "status"> & { status?: string }
): void {
  db.prepare(
    `INSERT INTO transactions (id, type, amount, timestamp, user_id, from_user_id, to_user_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    tx.id,
    tx.type,
    tx.amount,
    tx.timestamp,
    tx.user_id ?? null,
    tx.from_user_id ?? null,
    tx.to_user_id ?? null,
    tx.status ?? "processed"
  );
}

export function findAll(
  db: Database.Database,
  opts: { limit: number; offset: number }
): TransactionRow[] {
  return db
    .prepare("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?")
    .all(opts.limit, opts.offset) as TransactionRow[];
}

export function findByUserId(db: Database.Database, userId: string): TransactionRow[] {
  return db
    .prepare(
      `SELECT * FROM transactions
       WHERE user_id = ? OR from_user_id = ? OR to_user_id = ?
       ORDER BY timestamp DESC`
    )
    .all(userId, userId, userId) as TransactionRow[];
}

export function countAll(db: Database.Database): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM transactions").get() as { count: number };
  return row.count;
}
