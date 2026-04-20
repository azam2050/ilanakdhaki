import { Router, type IRouter } from "express";
import { runOptimizationCycle } from "../lib/optimizer";
import { runDailyCopyCycle } from "../lib/dailyCopy";

const router: IRouter = Router();

const enabled = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEBUG_TRIGGERS === "true";

router.post("/debug/run-optimizer", async (_req, res) => {
  if (!enabled) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  try {
    const result = await runOptimizationCycle();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/debug/run-daily-copy", async (_req, res) => {
  if (!enabled) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  try {
    const result = await runDailyCopyCycle();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
