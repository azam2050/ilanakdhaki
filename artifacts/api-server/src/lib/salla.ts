export const SALLA_AUTHORIZE_URL =
  "https://accounts.salla.sa/oauth2/auth";
export const SALLA_TOKEN_URL = "https://accounts.salla.sa/oauth2/token";
export const SALLA_USER_INFO_URL = "https://accounts.salla.sa/oauth2/user/info";

export const SALLA_DEFAULT_SCOPES = ["offline_access"];

export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "http://localhost:80";
}

export function getSallaRedirectUri(): string {
  return `${getAppBaseUrl()}/api/auth/salla/callback`;
}

export function requireSallaConfig(): {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
} {
  const clientId = process.env.SALLA_CLIENT_ID;
  const clientSecret = process.env.SALLA_CLIENT_SECRET;
  const webhookSecret = process.env.SALLA_WEBHOOK_SECRET;
  if (!clientId || !clientSecret || !webhookSecret) {
    throw new Error(
      "Salla is not configured. Missing SALLA_CLIENT_ID, SALLA_CLIENT_SECRET, or SALLA_WEBHOOK_SECRET.",
    );
  }
  return { clientId, clientSecret, webhookSecret };
}

export interface SallaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<SallaTokenResponse> {
  const { clientId, clientSecret } = requireSallaConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getSallaRedirectUri(),
  });
  const res = await fetch(SALLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Salla token exchange failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as SallaTokenResponse;
}

export interface SallaUserInfo {
  data?: {
    id?: number | string;
    name?: string;
    email?: string;
    mobile?: string;
    merchant?: {
      id?: number | string;
      username?: string;
      name?: string;
      domain?: string;
      email?: string;
    };
  };
}

export async function fetchSallaUserInfo(
  accessToken: string,
): Promise<SallaUserInfo> {
  const res = await fetch(SALLA_USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Salla user info failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as SallaUserInfo;
}
