const UUID = "[0-9a-fA-F-]{36}";
const GET_COLLECTIONS = ["programs", "courses", "videos", "media-assets", "learning-checks"];

export function isAllowedLearnerRequest(method: string, path: string) {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (method === "GET" && GET_COLLECTIONS.includes(clean)) return true;
  if (method === "GET" && new RegExp(`^(courses|activities|learning-checks)/${UUID}$`).test(clean)) return true;
  if (method === "GET" && ["me/progress", "me/activity-progress", "gamification/me", "career/opportunities"].includes(clean)) return true;
  if (method === "GET" && new RegExp(`^me/(courses|activities)/${UUID}/progress$`).test(clean)) return true;
  if (method === "GET" && new RegExp(`^learning-checks/${UUID}/results$`).test(clean)) return true;
  if (method === "POST" && clean === "progress") return true;
  if (method === "POST" && new RegExp(`^activities/${UUID}/(start|progress|complete)$`).test(clean)) return true;
  if (method === "POST" && new RegExp(`^learning-checks/${UUID}/(start|submit)$`).test(clean)) return true;
  if (method === "POST" && new RegExp(`^courses/${UUID}/chat$`).test(clean)) return true;
  return false;
}
