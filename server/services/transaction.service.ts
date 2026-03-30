import type Database from "better-sqlite3";
import { transactionInputSchema, toCents, type ProcessResult } from "../types/index.js";
import * as TransactionModel from "../models/transaction.model.js";
import * as InvalidTransactionModel from "../models/invalid-transaction.model.js";
import * as AccountModel from "../models/account.model.js";
import * as UserModel from "../models/user.model.js";
import { withRetry } from "./retry.js";
import { logger } from "../lib/logger.js";

export function processTransaction(db: Database.Database, rawInput: unknown): ProcessResult {
  const rawJson = JSON.stringify(rawInput);
  const originalId = typeof rawInput === "object" && rawInput !== null && "id" in rawInput
    ? String((rawInput as Record<string, unknown>).id)
    : null;

  // Step 1: Validate with Zod
  const parsed = transactionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const reason = parsed.error.issues.map((i) => i.message).join("; ");
    logger.warn({ originalId, reason }, "Transaction validation failed");
    InvalidTransactionModel.insert(db, { original_id: originalId, raw_data: rawJson, error_reason: reason });
    return { status: "invalid", id: originalId, reason };
  }

  const input = parsed.data;
  const amountCents = toCents(input.amount);

  // Step 2: Idempotency check
  const existing = TransactionModel.findById(db, input.id);
  if (existing) {
    logger.info({ id: input.id }, "Duplicate transaction ignored");
    return { status: "duplicate", id: input.id };
  }

  // Step 3: Verify users exist
  if (input.type === "deposit" || input.type === "withdraw") {
    if (!UserModel.exists(db, input.user_id)) {
      const reason = `User ${input.user_id} not found`;
      logger.warn({ id: input.id, userId: input.user_id }, reason);
      InvalidTransactionModel.insert(db, { original_id: input.id, raw_data: rawJson, error_reason: reason });
      return { status: "invalid", id: input.id, reason };
    }
  }

  if (input.type === "transfer") {
    if (!UserModel.exists(db, input.from_user_id)) {
      const reason = `Sender user ${input.from_user_id} not found`;
      logger.warn({ id: input.id }, reason);
      InvalidTransactionModel.insert(db, { original_id: input.id, raw_data: rawJson, error_reason: reason });
      return { status: "invalid", id: input.id, reason };
    }
    if (!UserModel.exists(db, input.to_user_id)) {
      const reason = `Receiver user ${input.to_user_id} not found`;
      logger.warn({ id: input.id }, reason);
      InvalidTransactionModel.insert(db, { original_id: input.id, raw_data: rawJson, error_reason: reason });
      return { status: "invalid", id: input.id, reason };
    }
  }

  // Step 4: Process atomically inside a SQLite transaction
  if (input.type === "deposit") {
    const executeDeposit = db.transaction(() => {
      TransactionModel.insert(db, {
        id: input.id,
        type: "deposit",
        amount: amountCents,
        timestamp: input.timestamp,
        user_id: input.user_id,
        from_user_id: null,
        to_user_id: null,
      });
      AccountModel.updateBalance(db, input.user_id, amountCents);
    });
    executeDeposit();
    logger.info({ id: input.id, type: "deposit", amount: input.amount, userId: input.user_id }, "Transaction processed");
  }

  if (input.type === "withdraw") {
    const currentBalance = AccountModel.getBalance(db, input.user_id);
    if (currentBalance < amountCents) {
      const reason = `Insufficient balance: has ${currentBalance / 100}, needs ${input.amount}`;
      logger.warn({ id: input.id, currentBalance: currentBalance / 100, requested: input.amount }, reason);
      InvalidTransactionModel.insert(db, { original_id: input.id, raw_data: rawJson, error_reason: reason });
      return { status: "invalid", id: input.id, reason };
    }

    const executeWithdraw = db.transaction(() => {
      TransactionModel.insert(db, {
        id: input.id,
        type: "withdraw",
        amount: amountCents,
        timestamp: input.timestamp,
        user_id: input.user_id,
        from_user_id: null,
        to_user_id: null,
      });
      AccountModel.updateBalance(db, input.user_id, -amountCents);
    });
    executeWithdraw();
    logger.info({ id: input.id, type: "withdraw", amount: input.amount, userId: input.user_id }, "Transaction processed");
  }

  if (input.type === "transfer") {
    const senderBalance = AccountModel.getBalance(db, input.from_user_id);
    if (senderBalance < amountCents) {
      const reason = `Insufficient balance for transfer: sender has ${senderBalance / 100}, needs ${input.amount}`;
      logger.warn({ id: input.id, senderBalance: senderBalance / 100, requested: input.amount }, reason);
      InvalidTransactionModel.insert(db, { original_id: input.id, raw_data: rawJson, error_reason: reason });
      return { status: "invalid", id: input.id, reason };
    }

    const executeTransfer = db.transaction(() => {
      TransactionModel.insert(db, {
        id: input.id,
        type: "transfer",
        amount: amountCents,
        timestamp: input.timestamp,
        user_id: null,
        from_user_id: input.from_user_id,
        to_user_id: input.to_user_id,
      });
      AccountModel.updateBalance(db, input.from_user_id, -amountCents);
      AccountModel.updateBalance(db, input.to_user_id, amountCents);
    });
    executeTransfer();
    logger.info(
      { id: input.id, type: "transfer", amount: input.amount, from: input.from_user_id, to: input.to_user_id },
      "Transaction processed"
    );
  }

  return { status: "processed", id: input.id };
}

export async function processTransactionWithRetry(
  db: Database.Database,
  rawInput: unknown
): Promise<ProcessResult> {
  return withRetry(() => processTransaction(db, rawInput));
}

export async function processBatch(
  db: Database.Database,
  transactions: unknown[]
): Promise<ProcessResult[]> {
  // Sort by timestamp before processing (handles out-of-order arrival)
  const sortable = transactions
    .map((tx, index) => ({ tx, index }))
    .sort((a, b) => {
      const tsA = typeof a.tx === "object" && a.tx !== null && "timestamp" in a.tx
        ? String((a.tx as Record<string, unknown>).timestamp)
        : "";
      const tsB = typeof b.tx === "object" && b.tx !== null && "timestamp" in b.tx
        ? String((b.tx as Record<string, unknown>).timestamp)
        : "";
      return tsA.localeCompare(tsB);
    });

  const results: ProcessResult[] = [];
  for (const { tx } of sortable) {
    const result = await processTransactionWithRetry(db, tx);
    results.push(result);
  }

  logger.info(
    {
      total: results.length,
      processed: results.filter((r) => r.status === "processed").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      invalid: results.filter((r) => r.status === "invalid").length,
    },
    "Batch processing complete"
  );

  return results;
}
