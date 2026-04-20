import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import {
  db,
  merchantsTable,
  oauthStatesTable,
  auditLogTable,
} from "@workspace/db";
import {
  SALLA_AUTHORIZE_URL,
  SALLA_DEFAULT_SCOPES,
  exchangeCodeForToken,
  fetchSallaUserInfo,
  getSallaRedirectUri,
  requireSallaConfig,
} from "../../lib/salla";
import { encryptToken, randomToken } from "../../lib/crypto";
import { createSession, setSessionCookie } from "../../lib/session";

const router: IRouter = Router();
const STATE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const NONCE_COOKIE = "sa_oauth_nonce";

function isSafeRelativePath(p: string): boolean {
  // Must start with single "/", not "//" (protocol-relative) or "/\\"
  if (!p.startsWith("/")) return false;
  if (p.startsWith("//") || p.startsWith("/\\")) return false;
  // Reject anything that decodes to an absolute URL
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p)) return false;
  return true;
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

router.get("/auth/salla/install", async (req, res): Promise<void> => {
  let cfg;
  try {
    cfg = requireSallaConfig();
  } catch (err) {
    req.log.error({ err }, "Salla not configured");
    res.status(503).json({ error: "Salla integration not configured" });
    return;
  }

  const state = randomToken(24);
  const nonce = randomToken(24);
  const requestedRedirect =
    typeof req.query.redirect_to === "string" ? req.query.redirect_to : "/";
  const redirectTo = isSafeRelativePath(requestedRedirect)
    ? requestedRedirect
    : "/";

  await db.insert(oauthStatesTable).values({
    state,
    provider: "salla",
    redirectTo,
    nonceHash: sha256(nonce),
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });

  const isProd = process.env.NODE_ENV === "production";
  res.cookie(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: STATE_TTL_MS,
    path: "/api/auth/salla",
  });

  const url = new URL(SALLA_AUTHORIZE_URL);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getSallaRedirectUri());
  url.searchParams.set("scope", SALLA_DEFAULT_SCOPES.join(" "));
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

router.get("/auth/salla/callback", async (req, res): Promise<void> => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;

  if (!code || !state) {
    res.status(400).json({ error: "Missing code or state" });
    return;
  }

  const cookies = (req as { cookies?: Record<string, string> }).cookies;
  const nonce = cookies?.[NONCE_COOKIE] ?? null;
  if (!nonce) {
    res.status(400).json({ error: "Missing OAuth nonce cookie" });
    return;
  }
  res.clearCookie(NONCE_COOKIE, { path: "/api/auth/salla" });

  const [stateRow] = await db
    .select()
    .from(oauthStatesTable)
    .where(
      and(
        eq(oauthStatesTable.state, state),
        eq(oauthStatesTable.provider, "salla"),
        gt(oauthStatesTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!stateRow) {
    req.log.warn({ state }, "Invalid or expired OAuth state");
    const { recordFailedLogin, clientIp } = await import("../../lib/security");
    recordFailedLogin(clientIp(req), "salla:invalid_state");
    res.status(400).json({ error: "Invalid or expired state" });
    return;
  }

  await db
    .delete(oauthStatesTable)
    .where(eq(oauthStatesTable.state, state));

  const expectedHash = Buffer.from(stateRow.nonceHash, "hex");
  const actualHash = Buffer.from(sha256(nonce), "hex");
  if (
    expectedHash.length !== actualHash.length ||
    !crypto.timingSafeEqual(expectedHash, actualHash)
  ) {
    req.log.warn("OAuth nonce mismatch");
    const { recordFailedLogin, clientIp } = await import("../../lib/security");
    recordFailedLogin(clientIp(req), "salla:nonce_mismatch");
    res.status(400).json({ error: "OAuth nonce mismatch" });
    return;
  }

  let token;
  let userInfo;
  try {
    token = await exchangeCodeForToken(code);
    userInfo = await fetchSallaUserInfo(token.access_token);
  } catch (err) {
    req.log.error({ err }, "Salla OAuth exchange failed");
    res.status(502).json({ error: "Salla authorization failed" });
    return;
  }

  const sallaMerchantId = String(
    userInfo.data?.merchant?.id ?? userInfo.data?.id ?? "",
  );
  if (!sallaMerchantId) {
    res.status(502).json({ error: "Salla did not return a merchant id" });
    return;
  }

  const accessTokenEncrypted = encryptToken(token.access_token);
  const refreshTokenEncrypted = token.refresh_token
    ? encryptToken(token.refresh_token)
    : null;
  const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);
  const storeName =
    userInfo.data?.merchant?.name ?? userInfo.data?.name ?? "Salla Store";
  const storeDomain = userInfo.data?.merchant?.domain ?? null;
  const ownerEmail =
    userInfo.data?.email ?? userInfo.data?.merchant?.email ?? null;
  const ownerPhone = userInfo.data?.mobile ?? null;
  const consents = {
    readStoreData: true,
    receiveWebhooks: true,
    shareAudienceNetwork: true,
    manageAdAccounts: true,
    acceptedAt: new Date().toISOString(),
  };

  // Atomic upsert keyed on the unique salla_merchant_id — avoids the classic
  // select-then-insert race when the merchant double-clicks the install button.
  const upserted = await db
    .insert(merchantsTable)
    .values({
      sallaMerchantId,
      storeName,
      storeDomain,
      ownerEmail,
      ownerPhone,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt,
      tokenScope: token.scope ?? null,
      consents,
    })
    .onConflictDoUpdate({
      target: merchantsTable.sallaMerchantId,
      set: {
        storeName,
        storeDomain,
        ownerEmail,
        ownerPhone,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        tokenScope: token.scope ?? null,
        consents,
      },
    })
    .returning({ id: merchantsTable.id, createdAt: merchantsTable.createdAt });
  const merchantId = upserted[0]!.id;
  const isNew =
    Date.now() - upserted[0]!.createdAt.getTime() < 5_000;

  await db.insert(auditLogTable).values({
    merchantId,
    action: isNew ? "salla.connect" : "salla.reconnect",
    details: { sallaMerchantId, storeName },
    ipAddress: req.ip ?? null,
  });

  const sessionToken = await createSession(merchantId);
  setSessionCookie(res, sessionToken);

  const redirectTo = isSafeRelativePath(stateRow.redirectTo ?? "/")
    ? (stateRow.redirectTo ?? "/")
    : "/";
  res.redirect(redirectTo);
});

export default router;
