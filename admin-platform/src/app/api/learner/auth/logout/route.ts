import { auth0 } from "@/lib/auth0";
import { clearLearnerSession, learnerAuthMethod, learnerRefreshToken } from "@/lib/server/learner-session";
import { clearSession, sessionRefreshToken } from "@/lib/server/session";
import { revokeRefreshToken } from "@/lib/server/token-revocation";

export async function POST() {
  const method = await learnerAuthMethod();
  await revokeRefreshToken(await learnerRefreshToken());
  let hasAuth0Session = false;
  if (method === "auth0" && auth0) {
    try {
      hasAuth0Session = Boolean(await auth0.getSession());
    } catch {
      // Provider availability must never prevent local logout.
    }
  }
  if (hasAuth0Session) {
    await revokeRefreshToken(await sessionRefreshToken());
    await clearSession();
    await clearLearnerSession();
    return Response.json({ redirect_to: "/auth/logout?returnTo=/learn/login", auth0: true });
  }
  await clearLearnerSession();
  return Response.json({ redirect_to: "/learn/login", auth0: false });
}
