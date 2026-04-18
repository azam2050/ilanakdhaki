import { Router, type IRouter } from "express";
import sallaRouter from "./salla";
import {
  clearSessionCookie,
  destroySession,
  readSessionCookie,
} from "../../lib/session";
import { requireSession } from "../../middlewares/requireSession";

const router: IRouter = Router();

router.use(sallaRouter);

router.get("/auth/me", requireSession, (req, res) => {
  const m = req.merchant!;
  res.json({
    id: m.id,
    storeName: m.storeName,
    storeDomain: m.storeDomain,
    plan: m.plan,
    category: m.category,
    sallaConnected: m.sallaMerchantId != null,
    zidConnected: m.zidMerchantId != null,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = readSessionCookie(req);
  if (token) await destroySession(token);
  clearSessionCookie(res);
  res.status(204).send();
});

export default router;
