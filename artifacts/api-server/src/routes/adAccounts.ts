import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, adAccountsTable } from "@workspace/db";
import { requireSession } from "../middlewares/requireSession";
import { encryptToken } from "../lib/crypto";

const router: IRouter = Router();

const PLATFORMS = ["meta", "snap", "tiktok", "google"] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_LABEL_AR: Record<Platform, string> = {
  meta: "ميتا",
  snap: "سناب شات",
  tiktok: "تيك توك",
  google: "جوجل",
};

const PLATFORM_BRAND: Record<Platform, string> = {
  meta: "#1877F2",
  snap: "#FFFC00",
  tiktok: "#000000",
  google: "#EA4335",
};

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

router.get(
  "/ad-accounts/connect-url",
  requireSession,
  async (req, res): Promise<void> => {
    const platform = req.query.platform;
    if (!isPlatform(platform)) {
      res.status(400).json({ error: "Invalid platform" });
      return;
    }
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
  },
);

router.delete(
  "/ad-accounts/:id",
  requireSession,
  async (req, res): Promise<void> => {
    const merchant = req.merchant!;
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }
    await db
      .delete(adAccountsTable)
      .where(
        and(
          eq(adAccountsTable.id, id),
          eq(adAccountsTable.merchantId, merchant.id),
        ),
      );
    res.status(204).end();
  },
);

router.post(
  "/ad-accounts/:platform/mock-connect",
  requireSession,
  async (req, res): Promise<void> => {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_DEMO_SESSION !== "true"
    ) {
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
          accessTokenEncrypted: encryptToken(`demo-token-${platform}`),
          accountIdExternal,
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
  },
);

router.get("/oauth/popup/:platform", requireSession, (req, res): void => {
  const platform = req.params.platform;
  if (!isPlatform(platform)) {
    res.status(400).send("Invalid platform");
    return;
  }
  const label = PLATFORM_LABEL_AR[platform];
  const brand = PLATFORM_BRAND[platform];
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ربط ${label}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:'Cairo','Segoe UI',Tahoma,sans-serif;background:#0b1d3a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:#fff;color:#0b1d3a;border-radius:20px;padding:40px 32px;text-align:center;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4)}
  .brand{width:64px;height:64px;border-radius:16px;background:${brand};margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:28px}
  h1{font-size:18px;margin:0 0 8px}
  p{color:#5a6a85;margin:0 0 24px;font-size:14px;line-height:1.6}
  .spinner{width:36px;height:36px;border:3px solid #e6ebf3;border-top-color:#0b1d3a;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .ok{color:#16a34a;font-weight:700;font-size:16px;margin-top:8px;display:none}
  .err{color:#dc2626;font-weight:600;font-size:14px;margin-top:8px;display:none}
  .btn{margin-top:16px;background:#0b1d3a;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-weight:700;cursor:pointer;font-family:inherit;display:none}
</style>
</head>
<body>
  <div class="card">
    <div class="brand">${label.charAt(0)}</div>
    <h1>جارٍ ربط ${label}</h1>
    <p id="status">يتم الآن ربط حسابك الإعلاني بأمان…</p>
    <div class="spinner" id="spinner"></div>
    <div class="ok" id="ok">✓ تم الربط بنجاح</div>
    <div class="err" id="err"></div>
    <button class="btn" id="closeBtn" onclick="window.close()">إغلاق</button>
  </div>
<script>
(async function(){
  const platform = ${JSON.stringify(platform)};
  try {
    const r = await fetch('/api/ad-accounts/' + platform + '/mock-connect', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('status').style.display = 'none';
    document.getElementById('ok').style.display = 'block';
    if (window.opener) {
      try { window.opener.postMessage({ type: 'ad-account-connected', platform: platform, account: data }, window.location.origin); } catch(e){}
    }
    setTimeout(function(){ window.close(); }, 600);
  } catch (e) {
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('status').style.display = 'none';
    var err = document.getElementById('err');
    err.textContent = 'تعذّر الربط، حاول مرة أخرى';
    err.style.display = 'block';
    document.getElementById('closeBtn').style.display = 'inline-block';
  }
})();
</script>
</body>
</html>`);
});

export default router;
