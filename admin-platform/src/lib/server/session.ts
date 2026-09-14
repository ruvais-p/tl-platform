import "server-only";

import { cookies } from "next/headers";
import { getApiBaseUrl, secureCookies } from "@/lib/env";

const ACCESS_COOKIE = "tella_admin_access";
const REFRESH_COOKIE = "tella_admin_refresh";
const AUTH_METHOD_COOKIE = "tella_admin_auth_method";
const cookieOptions = () => ({ httpOnly: true, secure: secureCookies(), sameSite: "lax" as const, path: "/", priority: "high" as const });

export type TokenPair = { access: string; refresh: string };
export type SessionAuthMethod = "password" | "auth0" | "moodle";

export async function setSession(tokens: TokenPair, authMethod: SessionAuthMethod = "password") {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.access, { ...cookieOptions(), maxAge: 15 * 60 });
  store.set(REFRESH_COOKIE, tokens.refresh, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 });
  store.set(AUTH_METHOD_COOKIE, authMethod, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(AUTH_METHOD_COOKIE);
}

async function refreshSession() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const response = await fetch(`${getApiBaseUrl()}/auth/refresh/`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh }), cache: "no-store",
  });
  if (!response.ok) { await clearSession(); return null; }
  const tokens = await response.json() as { access: string; refresh?: string };
  const pair = { access: tokens.access, refresh: tokens.refresh || refresh };
  const authMethod = await sessionAuthMethod();
  await setSession(pair, authMethod);
  return pair.access;
}

export async function djangoRequest(path: string, init: RequestInit = {}, retry = true) {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (!access) return new Response(JSON.stringify({ detail: "Authentication required." }), { status: 401, headers: { "content-type": "application/json" } });
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${access}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  let response = await fetch(`${getApiBaseUrl()}/${path.replace(/^\//, "")}`, { ...init, headers, cache: "no-store" });
  if (response.status === 401 && retry) {
    const nextAccess = await refreshSession();
    if (!nextAccess) return response;
    headers.set("authorization", `Bearer ${nextAccess}`);
    response = await fetch(`${getApiBaseUrl()}/${path.replace(/^\//, "")}`, { ...init, headers, cache: "no-store" });
  }
  return response;
}

export async function sessionRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function sessionAuthMethod(): Promise<SessionAuthMethod> {
  const method = (await cookies()).get(AUTH_METHOD_COOKIE)?.value;
  return method === "auth0" || method === "moodle" ? method : "password";
}
