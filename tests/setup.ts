import { beforeEach } from "vitest";
import { createDatabase } from "../server/db/connection.js";
import { up as initialMigration } from "../server/db/migrations/001_initial.js";
import type Database from "better-sqlite3";
import { randomUUID } from "crypto";

export let testDb: Database.Database;

// User IDs we can reference in tests
export const USERS = {
  alice: { id: "", name: "Alice Santos", email: "alice@test.com" },
  bob: { id: "", name: "Bob Oliveira", email: "bob@test.com" },
  carlos: { id: "", name: "Carlos Silva", email: "carlos@test.com" },
};

beforeEach(() => {
  // Fresh in-memory DB for each test
  testDb = createDatabase();
  initialMigration(testDb);

  // Seed test users
  const insertUser = testDb.prepare(
    "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, 'hash', 'user')"
  );
  const insertAccount = testDb.prepare(
    "INSERT INTO accounts (id, user_id, account_number, balance) VALUES (?, ?, ?, ?)"
  );

  // Reset IDs each run
  USERS.alice.id = randomUUID();
  USERS.bob.id = randomUUID();
  USERS.carlos.id = randomUUID();

  const seedAll = testDb.transaction(() => {
    insertUser.run(USERS.alice.id, USERS.alice.name, USERS.alice.email);
    insertAccount.run(randomUUID(), USERS.alice.id, "1001", 500000); // R$5000

    insertUser.run(USERS.bob.id, USERS.bob.name, USERS.bob.email);
    insertAccount.run(randomUUID(), USERS.bob.id, "1002", 300000); // R$3000

    insertUser.run(USERS.carlos.id, USERS.carlos.name, USERS.carlos.email);
    insertAccount.run(randomUUID(), USERS.carlos.id, "1003", 100000); // R$1000
  });

  seedAll();
});
