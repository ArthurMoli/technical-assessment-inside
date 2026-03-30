import { Router } from "express";
import { getDatabase } from "../db/connection.js";

const router = Router();

router.get("/", (_req, res) => {
  try {
    const db = getDatabase();
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", message: "Database unavailable" });
  }
});

export default router;
