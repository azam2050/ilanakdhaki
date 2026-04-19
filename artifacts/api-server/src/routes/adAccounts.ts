import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, adAccountsTable } from "@workspace/db";
import { requireSession } from "../middlewares/requireSession";
import { encryptToken } from "../lib/crypto";

const router: IRouter = Router();

const PLATFORMS = ["meta", "snap", "tiktok", "google"] as const;
type Platform = (typeof PLATFORMS)[number];

function isPlatform(p: unknown): p is Platform {
  return typeof p === "string" && (PLATFORMS as readonly string[]).includes(p);
}

router.get("/ad-accounts", requireSession, async (req, res) => {
  const merchant = req.merchant!;
  const rows = await db
    .select()
    .from(adAccountsTable)
    .where(eq(adAccountsTable.merchantId, merchant.id));
  res.json(
    rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      accountIdExternal: r.accountIdExternal,
      status: r.status,
      connectedAt: r.connectedAt.toISOString(),
    })),
  );
});

router.get("/ad-accounts/connect-url", requireSession, async (req, res): Promise<void> => {
  const platform = req.query.platform;
  if (!isPlatform(platform)) {
    res.status(400).json({ error: "Invalid platform" });
    return;
  }
  // Real OAuth URLs require per-platform client credentials we do not have yet.
  // Return available=false with an Arabic explanation so the dashboard can offer the demo connect.
  const reasonByPlatform: Record<Platform, string> = {
    meta: "سنفعّل الربط مع ميتا فور إعداد بيانات الإعلانات الرسمية لدينا.",
    snap: "سنفعّل الربط مع سناب فور إعداد بيانات الإعلانات الرسمية لدينا.",
    tiktok: "سنفعّل الربط مع تيك توك فور إعداد بيانات الإعلانات الرسمية لدينا.",
    google: "سنفعّل الربط مع قوقل فور إعداد بيانات الإعلانات الرسمية لدينا.",
  };
  res.json({
    url: "",
    available: false,
    reasonArabic: reasonByPlatform[platform],
  });
});

router.post("/ad-accounts/:platform/mock-connect", requireSession, async (req, res): Promise<void> => {
  // Mock-connect bypasses real OAuth and must be disabled in production.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SESSION !== "true") {
    res.status(404).json({ error: "Not available" });
    return;
  }
  const platform = req.params.platform;
  if (!isPlatform(platform)) {
    res.status(400).json({ error: "Invalid platform" });
    return;
  }
  const merchant = req.merchant!;
  const accountIdExternal = `demo-${platform}-${merchant.id.slice(0, 8)}`;
  const [existing] = await db
    .select()
    .from(adAccountsTable)
    .where(
      and(
        eq(adAccountsTable.merchantId, merchant.id),
        eq(adAccountsTable.platform, platform),
        eq(adAccountsTable.accountIdExternal, accountIdExternal),
      ),
    )
    .limit(1);
  let row = existing;
  if (!row) {
    [row] = await db
      .insert(adAccountsTable)
      .values({
        merchantId: merchant.id,
        platform,
        accountIdExternal,
        accessTokenEncrypted: encryptToken(`demo-token-${platform}`),
        status: "demo",
      })
      .returning();
  }
  res.json({
    id: row!.id,
    platform: row!.platform,
    accountIdExternal: row!.accountIdExternal,
    status: row!.status,
    connectedAt: row!.connectedAt.toISOString(),
  });
});

export default router;
