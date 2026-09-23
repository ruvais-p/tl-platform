import { NextResponse } from "next/server";
import { auth0, auth0Audience } from "@/lib/auth0";
import { parsePortal, safeContinuation, type AuthPortal } from "@/lib/auth/continuation";
import { getApiBaseUrl } from "@/lib/env";
import { clearLearnerSession, setLearnerSession } from "@/lib/server/learner-session";
import { clearSession, setSession, type TokenPair } from "@/lib/server/session";

type ExchangePayload = TokenPair & { user: { id: string; portal_access?: { staff?: boolean; learner?: boolean } } };

function noStoreRedirect(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

function loginError(request: Request, portal: AuthPortal, code = "access_denied") {
  const path = portal === "learner" ? "/learn/login" : "/login";
  return noStoreRedirect(request, `${path}?auth0_error=${encodeURIComponent(code)}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const portal = parsePortal(url.searchParams.get("portal"));
  if (!portal) return noStoreRedirect(request, "/login?auth0_error=access_denied");
  const destination = safeContinuation(portal, url.searchParams.get("next"));
  const clearPortal = portal === "learner" ? clearLearnerSession : clearSession;
  if (!auth0 || !auth0Audience) {
    await clearPortal();
    return loginError(request, portal, "unavailable");
  }
  try {
    const session = await auth0.getSession();
    if (!session) {
      await clearPortal();
      return loginError(request, portal);
    }
    const { token } = await auth0.getAccessToken({ audience: auth0Audience });
    const exchange = await fetch(`${getApiBaseUrl()}/auth/auth0/exchange/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assertion: token, portal }),
      cache: "no-store",
    });
    if (!exchange.ok) {
      await clearPortal();
      return loginError(request, portal);
    }
    const payload = await exchange.json() as ExchangePayload;
    const admitted = portal === "learner"
      ? payload.user?.portal_access?.learner
      : payload.user?.portal_access?.staff;
    if (!payload.access || !payload.refresh || !payload.user?.id || admitted !== true) {
      await clearPortal();
      return loginError(request, portal);
    }
    if (portal === "learner") {
      await setLearnerSession(payload, "auth0");
    } else {
      await setSession(payload, "auth0");
    }
    return noStoreRedirect(request, destination);
  } catch {
    await clearPortal();
    return loginError(request, portal, "unavailable");
  }
}
