import { getApiBaseUrl } from "@/lib/env";
import { forwardResponse } from "@/lib/server/response";
import { clearLearnerSession, setLearnerSession, type LearnerTokenPair } from "@/lib/server/learner-session";

export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(`${getApiBaseUrl()}/auth/login/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });
  if (!response.ok) return forwardResponse(response);
  const tokens = await response.json() as LearnerTokenPair;
  await setLearnerSession(tokens);
  const me = await fetch(`${getApiBaseUrl()}/auth/me/`, {
    headers: { authorization: `Bearer ${tokens.access}` },
    cache: "no-store",
  });
  if (!me.ok) {
    await clearLearnerSession();
    return forwardResponse(me);
  }
  const user = await me.json() as { groups?: string[] };
  if (!user.groups?.includes("STUDENT")) {
    await clearLearnerSession();
    return Response.json({ detail: "This account does not have access to the learner workspace." }, { status: 403 });
  }
  return Response.json({ ok: true });
}
