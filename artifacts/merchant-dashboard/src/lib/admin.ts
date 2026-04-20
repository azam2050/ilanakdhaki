const TOKEN_KEY = "smart_ads_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* noop */
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

export async function adminFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error("missing_token");
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401 || res.status === 503) {
    clearAdminToken();
    throw new Error(res.status === 503 ? "admin_not_configured" : "unauthorized");
  }
  if (!res.ok) {
    throw new Error(`http_${res.status}`);
  }
  return (await res.json()) as T;
}
