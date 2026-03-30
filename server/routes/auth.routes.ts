import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDatabase } from "../db/connection.js";
import type { UserRow } from "../types/index.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const db = getDatabase();
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logger.warn({ email }, "Failed login attempt");
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  logger.info({ userId: user.id, email: user.email, role: user.role }, "User logged in");

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

export default router;
