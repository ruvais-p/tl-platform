import { getApiBaseUrl } from "@/lib/env";
import { forwardResponse } from "@/lib/server/response";
import { clearSession, setSession, type TokenPair } from "@/lib/server/session";

const ADMIN_GROUPS = new Set(["SUPER_ADMIN", "ADMIN", "ACADEMIC_MANAGER", "CONTENT_MANAGER"]);

export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(`${getApiBaseUrl()}/auth/login/`, { method: "POST", headers: { "content-type": "application/json" }, body, cache: "no-store" });
  if (!response.ok) return forwardResponse(response);
  const tokens = await response.json() as TokenPair;
  await setSession(tokens);
  const me = await fetch(`${getApiBaseUrl()}/auth/me/`, { headers: { authorization: `Bearer ${tokens.access}` }, cache: "no-store" });
  if (!me.ok) { await clearSession(); return forwardResponse(me); }
  const user = await me.json() as { groups?: string[]; is_superuser?: boolean };
  if (!user.is_superuser && !user.groups?.some(group => ADMIN_GROUPS.has(group))) {
    await clearSession();
    return Response.json({ detail: "This account does not have access to the staff workspace." }, { status: 403 });
  }
  return Response.json({ ok: true });
}
