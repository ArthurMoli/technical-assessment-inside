import { z } from "zod";

// --- Zod Schemas ---

const baseTransactionSchema = z.object({
  id: z.string().min(1, "Transaction ID is required"),
  amount: z.number().positive("Amount must be positive"),
  timestamp: z.string().min(1, "Timestamp is required"),
});

const depositSchema = baseTransactionSchema.extend({
  type: z.literal("deposit"),
  user_id: z.string().min(1, "user_id is required for deposit"),
});

const withdrawSchema = baseTransactionSchema.extend({
  type: z.literal("withdraw"),
  user_id: z.string().min(1, "user_id is required for withdraw"),
});

const transferSchema = baseTransactionSchema.extend({
  type: z.literal("transfer"),
  from_user_id: z.string().min(1, "from_user_id is required for transfer"),
  to_user_id: z.string().min(1, "to_user_id is required for transfer"),
});

const baseInputSchema = z.discriminatedUnion("type", [
  depositSchema,
  withdrawSchema,
  transferSchema,
]);

export const transactionInputSchema = baseInputSchema.pipe(
  z.any().superRefine((data, ctx) => {
    if (data.type === "transfer" && data.from_user_id === data.to_user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cannot transfer to the same user",
        path: ["to_user_id"],
      });
    }
  })
);

export type TransactionInput = z.infer<typeof transactionInputSchema>;

// --- Database Row Types ---

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
  created_at: string;
}

export interface AccountRow {
  id: string;
  user_id: string;
  account_number: string;
  balance: number;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  type: "deposit" | "withdraw" | "transfer";
  amount: number;
  timestamp: string;
  user_id: string | null;
  from_user_id: string | null;
  to_user_id: string | null;
  status: "processed" | "failed";
  processed_at: string;
}

export interface InvalidTransactionRow {
  id: number;
  original_id: string | null;
  raw_data: string;
  error_reason: string;
  received_at: string;
}

// --- API Response Types ---

export interface UserWithBalance extends UserRow {
  account_number: string;
  balance: number;
}

export interface TransactionSummary {
  total_deposits: number;
  total_withdrawals: number;
  total_transfers: number;
  deposit_count: number;
  withdrawal_count: number;
  transfer_count: number;
}

export type ProcessResult =
  | { status: "processed"; id: string }
  | { status: "duplicate"; id: string }
  | { status: "invalid"; id: string | null; reason: string };

// --- Amount Helpers ---

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
