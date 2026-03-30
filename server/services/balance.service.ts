import type Database from "better-sqlite3";
import type { TransactionSummary } from "../types/index.js";

export function getBalance(db: Database.Database, userId: string): number {
  const row = db
    .prepare("SELECT balance FROM accounts WHERE user_id = ?")
    .get(userId) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

export function recalculateBalance(db: Database.Database, userId: string): number {
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'deposit' AND user_id = ? THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type = 'withdraw' AND user_id = ? THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type = 'transfer' AND from_user_id = ? THEN amount ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN type = 'transfer' AND to_user_id = ? THEN amount ELSE 0 END), 0)
        AS calculated_balance
       FROM transactions
       WHERE status = 'processed'`
    )
    .get(userId, userId, userId, userId) as { calculated_balance: number };
  return row.calculated_balance;
}

export function getSummary(db: Database.Database): TransactionSummary {
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) AS total_deposits,
        COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END), 0) AS total_withdrawals,
        COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0) AS total_transfers,
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN 1 ELSE 0 END), 0) AS deposit_count,
        COALESCE(SUM(CASE WHEN type = 'withdraw' THEN 1 ELSE 0 END), 0) AS withdrawal_count,
        COALESCE(SUM(CASE WHEN type = 'transfer' THEN 1 ELSE 0 END), 0) AS transfer_count
       FROM transactions
       WHERE status = 'processed'`
    )
    .get() as TransactionSummary;

  return row;
}
