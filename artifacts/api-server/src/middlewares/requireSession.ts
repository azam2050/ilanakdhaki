import type { Request, Response, NextFunction } from "express";
import type { Merchant } from "@workspace/db";
import { loadMerchantBySessionToken, readSessionCookie } from "../lib/session";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      merchant?: Merchant;
    }
  }
}

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readSessionCookie(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const merchant = await loadMerchantBySessionToken(token);
  if (!merchant) {
    res.status(401).json({ error: "Session expired" });
    return;
  }
  req.merchant = merchant;
  next();
}
