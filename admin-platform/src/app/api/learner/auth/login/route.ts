import { getApiBaseUrl } from "@/lib/env";
import { forwardResponse } from "@/lib/server/response";
import { clearLearnerSession, setLearnerSession, type LearnerTokenPair } from "@/lib/server/learner-session";

export async function POST(request: Request) {
  let credentials: Record<string, unknown>;
  try {
    credentials = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ detail: "Invalid login request." }, { status: 400 });
  }
  const body = JSON.stringify({ ...credentials, portal: "learner" });
  const response = await fetch(`${getApiBaseUrl()}/auth/login/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });
  if (!response.ok) return forwardResponse(response);
  const tokens = await response.json() as LearnerTokenPair;
  await setLearnerSession(tokens, "password");
  const me = await fetch(`${getApiBaseUrl()}/auth/me/`, {
    headers: { authorization: `Bearer ${tokens.access}` },
    cache: "no-store",
  });
  if (!me.ok) {
    await clearLearnerSession();
    return forwardResponse(me);
  }
  const user = await me.json() as { portal_access?: { learner?: boolean } };
  if (user.portal_access?.learner !== true) {
    await clearLearnerSession();
    return Response.json({ detail: "This account cannot access the requested workspace." }, { status: 403 });
  }
  return Response.json({ ok: true });
}
