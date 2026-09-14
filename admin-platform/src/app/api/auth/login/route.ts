import { getApiBaseUrl } from "@/lib/env";
import { forwardResponse } from "@/lib/server/response";
import { clearSession, setSession, type TokenPair } from "@/lib/server/session";

export async function POST(request: Request) {
  let credentials: Record<string, unknown>;
  try {
    credentials = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ detail: "Invalid login request." }, { status: 400 });
  }
  const body = JSON.stringify({ ...credentials, portal: "staff" });
  const response = await fetch(`${getApiBaseUrl()}/auth/login/`, { method: "POST", headers: { "content-type": "application/json" }, body, cache: "no-store" });
  if (!response.ok) return forwardResponse(response);
  const tokens = await response.json() as TokenPair;
  await setSession(tokens, "password");
  const me = await fetch(`${getApiBaseUrl()}/auth/me/`, { headers: { authorization: `Bearer ${tokens.access}` }, cache: "no-store" });
  if (!me.ok) { await clearSession(); return forwardResponse(me); }
  const user = await me.json() as { portal_access?: { staff?: boolean } };
  if (user.portal_access?.staff !== true) {
    await clearSession();
    return Response.json({ detail: "This account cannot access the requested workspace." }, { status: 403 });
  }
  return Response.json({ ok: true });
}
