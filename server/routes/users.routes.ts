import { Router } from "express";
import { getDatabase } from "../db/connection.js";
import * as UserModel from "../models/user.model.js";
import { fromCents } from "../types/index.js";

const router = Router();

router.get("/", (_req, res) => {
  const db = getDatabase();
  const users = UserModel.findAll(db).map((u) => ({
    ...u,
    balance: fromCents(u.balance),
  }));
  res.json(users);
});

router.get("/:id", (req, res) => {
  const db = getDatabase();
  const user = UserModel.findById(db, req.params.id);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ ...user, balance: fromCents(user.balance) });
});

export default router;
