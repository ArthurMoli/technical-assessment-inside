import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { logger } from "../lib/logger.js";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin";
  accountNumber: string;
  initialBalance: number;
}

const SEED_USERS: SeedUser[] = [
  { name: "Admin", email: "admin@arthurbank.com", password: "admin123", role: "admin", accountNumber: "0001", initialBalance: 0 },
  { name: "Alice Santos", email: "alice@arthurbank.com", password: "alice123", role: "user", accountNumber: "1001", initialBalance: 500000 },
  { name: "Bob Oliveira", email: "bob@arthurbank.com", password: "bob123", role: "user", accountNumber: "1002", initialBalance: 300000 },
  { name: "Carlos Silva", email: "carlos@arthurbank.com", password: "carlos123", role: "user", accountNumber: "1003", initialBalance: 150000 },
  { name: "Diana Costa", email: "diana@arthurbank.com", password: "diana123", role: "user", accountNumber: "1004", initialBalance: 750000 },
  { name: "Eduardo Lima", email: "eduardo@arthurbank.com", password: "eduardo123", role: "user", accountNumber: "1005", initialBalance: 200000 },
];

export function seedDatabase(db: Database.Database): void {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };

  if (userCount.count > 0) {
    logger.info("Database already seeded, skipping");
    return;
  }

  logger.info("Seeding database...");

  const insertUser = db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
  );
  const insertAccount = db.prepare(
    "INSERT INTO accounts (id, user_id, account_number, balance) VALUES (?, ?, ?, 0)"
  );
  const insertTransaction = db.prepare(
    "INSERT INTO transactions (id, type, amount, timestamp, user_id, from_user_id, to_user_id, status) VALUES (?, 'deposit', ?, ?, ?, NULL, NULL, 'processed')"
  );
  const updateBalance = db.prepare(
    "UPDATE accounts SET balance = ? WHERE user_id = ?"
  );

  const seedAll = db.transaction(() => {
    for (const user of SEED_USERS) {
      const userId = randomUUID();
      const accountId = randomUUID();
      const passwordHash = bcrypt.hashSync(user.password, 10);

      insertUser.run(userId, user.name, user.email, passwordHash, user.role);
      insertAccount.run(accountId, userId, user.accountNumber);

      // Registrar saldo inicial como transação de depósito
      if (user.initialBalance > 0) {
        const txId = `seed-deposit-${userId}`;
        const seedTimestamp = "2026-01-01T00:00:00Z";
        insertTransaction.run(txId, user.initialBalance, seedTimestamp, userId);
        updateBalance.run(user.initialBalance, userId);

        logger.info(
          { name: user.name, accountNumber: user.accountNumber, deposit: user.initialBalance / 100 },
          "Seeded user with initial deposit"
        );
      } else {
        logger.info({ name: user.name, role: user.role }, "Seeded user");
      }
    }
  });

  seedAll();
  logger.info(`Seeded ${SEED_USERS.length} users with accounts`);
}
