import { Router } from "express";
import { getDatabase } from "../db/connection.js";
import * as TransactionModel from "../models/transaction.model.js";
import * as InvalidTransactionModel from "../models/invalid-transaction.model.js";
import { processTransactionWithRetry, processBatch } from "../services/transaction.service.js";
import * as BalanceService from "../services/balance.service.js";
import { fromCents } from "../types/index.js";

const router = Router();

// Process a single transaction
router.post("/", async (req, res) => {
  try {
    const db = getDatabase();
    const result = await processTransactionWithRetry(db, req.body);
    const statusCode = result.status === "processed" ? 201
      : result.status === "duplicate" ? 200
      : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to process transaction", message: (error as Error).message });
  }
});

// Process a batch of transactions
router.post("/batch", async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      res.status(400).json({ error: "Request body must be an array of transactions" });
      return;
    }
    const db = getDatabase();
    const results = await processBatch(db, req.body);
    res.json({
      total: results.length,
      processed: results.filter((r) => r.status === "processed").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      invalid: results.filter((r) => r.status === "invalid").length,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process batch", message: (error as Error).message });
  }
});

// Get transaction summary
router.get("/summary", (_req, res) => {
  const db = getDatabase();
  const summary = BalanceService.getSummary(db);
  res.json({
    total_deposits: fromCents(summary.total_deposits),
    total_withdrawals: fromCents(summary.total_withdrawals),
    total_transfers: fromCents(summary.total_transfers),
    deposit_count: summary.deposit_count,
    withdrawal_count: summary.withdrawal_count,
    transfer_count: summary.transfer_count,
  });
});

// List invalid transactions
router.get("/invalid", (req, res) => {
  const db = getDatabase();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const items = InvalidTransactionModel.findAll(db, { limit, offset });
  const total = InvalidTransactionModel.countAll(db);
  res.json({ items, total, limit, offset });
});

// Get transactions for a specific user
router.get("/user/:userId", (req, res) => {
  const db = getDatabase();
  const transactions = TransactionModel.findByUserId(db, req.params.userId).map((tx) => ({
    ...tx,
    amount: fromCents(tx.amount),
  }));
  res.json(transactions);
});

// List all transactions (paginated)
router.get("/", (req, res) => {
  const db = getDatabase();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const items = TransactionModel.findAll(db, { limit, offset }).map((tx) => ({
    ...tx,
    amount: fromCents(tx.amount),
  }));
  const total = TransactionModel.countAll(db);
  res.json({ items, total, limit, offset });
});

export default router;
