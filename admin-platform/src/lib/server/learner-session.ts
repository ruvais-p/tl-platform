import "server-only";

import { cookies } from "next/headers";
import { getApiBaseUrl, secureCookies } from "@/lib/env";

const ACCESS_COOKIE = "tella_learner_access";
const REFRESH_COOKIE = "tella_learner_refresh";
const cookieOptions = () => ({
  httpOnly: true,
  secure: secureCookies(),
  sameSite: "lax" as const,
  path: "/",
  priority: "high" as const,
});

export type LearnerTokenPair = { access: string; refresh: string };

export async function setLearnerSession(tokens: LearnerTokenPair) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.access, { ...cookieOptions(), maxAge: 15 * 60 });
  store.set(REFRESH_COOKIE, tokens.refresh, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 });
}

export async function clearLearnerSession() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

async function refreshLearnerSession() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const response = await fetch(`${getApiBaseUrl()}/auth/refresh/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });
  if (!response.ok) {
    await clearLearnerSession();
    return null;
  }
  const tokens = await response.json() as { access: string; refresh?: string };
  const pair = { access: tokens.access, refresh: tokens.refresh || refresh };
  await setLearnerSession(pair);
  return pair.access;
}

export async function learnerDjangoRequest(path: string, init: RequestInit = {}, retry = true) {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (!access) {
    return Response.json({ detail: "Authentication required." }, { status: 401 });
  }
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${access}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const url = `${getApiBaseUrl()}/${path.replace(/^\//, "")}`;
  let response = await fetch(url, { ...init, headers, cache: "no-store" });
  if (response.status === 401 && retry) {
    const nextAccess = await refreshLearnerSession();
    if (!nextAccess) return response;
    headers.set("authorization", `Bearer ${nextAccess}`);
    response = await fetch(url, { ...init, headers, cache: "no-store" });
  }
  return response;
}

export async function learnerRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
