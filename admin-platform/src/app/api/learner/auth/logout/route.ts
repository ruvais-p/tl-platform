import { clearLearnerSession, learnerDjangoRequest, learnerRefreshToken } from "@/lib/server/learner-session";

export async function POST() {
  const refresh = await learnerRefreshToken();
  if (refresh) {
    await learnerDjangoRequest("auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }, false);
  }
  await clearLearnerSession();
  return new Response(null, { status: 204 });
}
