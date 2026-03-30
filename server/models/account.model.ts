import type Database from "better-sqlite3";
import type { AccountRow } from "../types/index.js";

export function findByUserId(db: Database.Database, userId: string): AccountRow | undefined {
  return db
    .prepare("SELECT * FROM accounts WHERE user_id = ?")
    .get(userId) as AccountRow | undefined;
}

export function updateBalance(db: Database.Database, userId: string, delta: number): void {
  db.prepare("UPDATE accounts SET balance = balance + ? WHERE user_id = ?").run(delta, userId);
}

export function getBalance(db: Database.Database, userId: string): number {
  const row = db
    .prepare("SELECT balance FROM accounts WHERE user_id = ?")
    .get(userId) as { balance: number } | undefined;
  return row?.balance ?? 0;
}
