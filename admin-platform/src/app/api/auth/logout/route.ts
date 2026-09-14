import { auth0 } from "@/lib/auth0";
import { clearLearnerSession, learnerRefreshToken } from "@/lib/server/learner-session";
import { clearSession, sessionAuthMethod, sessionRefreshToken } from "@/lib/server/session";
import { revokeRefreshToken } from "@/lib/server/token-revocation";

export async function POST() {
  const method = await sessionAuthMethod();
  const refresh = await sessionRefreshToken();
  await revokeRefreshToken(refresh);
  let hasAuth0Session = false;
  if (method === "auth0" && auth0) {
    try {
      hasAuth0Session = Boolean(await auth0.getSession());
    } catch {
      // Provider availability must never prevent local logout.
    }
  }
  if (hasAuth0Session) {
    await revokeRefreshToken(await learnerRefreshToken());
    await clearLearnerSession();
    await clearSession();
    return Response.json({ redirect_to: "/auth/logout?returnTo=/login", auth0: true });
  }
  await clearSession();
  return Response.json({ redirect_to: "/login", auth0: false });
}
