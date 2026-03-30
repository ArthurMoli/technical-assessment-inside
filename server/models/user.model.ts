import type Database from "better-sqlite3";
import type { UserRow, UserWithBalance } from "../types/index.js";

export function findAll(db: Database.Database): UserWithBalance[] {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.created_at, a.account_number, a.balance
       FROM users u
       JOIN accounts a ON a.user_id = u.id
       ORDER BY u.name`
    )
    .all() as UserWithBalance[];
}

export function findById(db: Database.Database, id: string): UserWithBalance | undefined {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.created_at, a.account_number, a.balance
       FROM users u
       JOIN accounts a ON a.user_id = u.id
       WHERE u.id = ?`
    )
    .get(id) as UserWithBalance | undefined;
}

export function exists(db: Database.Database, id: string): boolean {
  const row = db.prepare("SELECT 1 FROM users WHERE id = ?").get(id);
  return !!row;
}
