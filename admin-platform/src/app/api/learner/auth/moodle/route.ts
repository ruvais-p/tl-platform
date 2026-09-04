import { getApiBaseUrl } from "@/lib/env";
import { forwardResponse } from "@/lib/server/response";
import { clearLearnerSession, setLearnerSession } from "@/lib/server/learner-session";

export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(`${getApiBaseUrl()}/auth/moodle/exchange/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });
  if (!response.ok) return forwardResponse(response);
  const payload = await response.json() as {
    access: string;
    refresh: string;
    user?: { groups?: string[] };
  };
  if (!payload.user?.groups?.includes("STUDENT")) {
    await clearLearnerSession();
    return Response.json({ detail: "The Moodle account is not enrolled as a learner." }, { status: 403 });
  }
  await setLearnerSession({ access: payload.access, refresh: payload.refresh });
  return Response.json({ ok: true, user: payload.user });
}
