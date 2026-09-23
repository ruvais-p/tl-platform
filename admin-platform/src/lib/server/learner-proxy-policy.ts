const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const GET_COLLECTIONS = ["programs", "courses", "videos", "media-assets", "learning-checks"];

export function isAllowedLearnerRequest(method: string, path: string) {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (method === "GET" && GET_COLLECTIONS.includes(clean)) return true;
  if (method === "GET" && new RegExp(`^(courses|activities|learning-checks)/${UUID}$`).test(clean)) return true;
  if (method === "GET" && ["me/progress", "me/activity-progress", "gamification/me", "career/opportunities"].includes(clean)) return true;
  if (method === "GET" && clean === "career/applications/me") return true;
  if (method === "GET" && new RegExp(`^career/opportunities/${UUID}$`).test(clean)) return true;
  if (method === "GET" && new RegExp(`^career/applications/${UUID}/resume$`).test(clean)) return true;
  if (method === "GET" && new RegExp(`^me/(courses|activities)/${UUID}/progress$`).test(clean)) return true;
  if (method === "GET" && new RegExp(`^learning-checks/${UUID}/results$`).test(clean)) return true;
  if (method === "POST" && clean === "progress") return true;
  if (method === "POST" && new RegExp(`^activities/${UUID}/(start|progress|complete)$`).test(clean)) return true;
  if (method === "POST" && new RegExp(`^learning-checks/${UUID}/(start|submit)$`).test(clean)) return true;
  if (method === "POST" && new RegExp(`^courses/${UUID}/chat$`).test(clean)) return true;
  if (["GET", "POST"].includes(method) && new RegExp(`^courses/${UUID}/support-conversation$`).test(clean)) return true;
  if (method === "GET" && new RegExp(`^course-support/conversations/${UUID}/messages$`).test(clean)) return true;
  if (method === "POST" && new RegExp(`^course-support/conversations/${UUID}/read$`).test(clean)) return true;
  if (method === "POST" && clean === "course-support/socket-ticket") return true;
  if (method === "POST" && new RegExp(`^career/opportunities/${UUID}/applications$`).test(clean)) return true;
  if (method === "POST" && new RegExp(`^career/applications/${UUID}/withdraw$`).test(clean)) return true;
  return false;
}
