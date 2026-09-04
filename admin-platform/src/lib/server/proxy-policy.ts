const COLLECTIONS = ["programs", "courses", "course-versions", "chapters", "subtopics", "activities", "activity-content", "experiments"];
const UUID = "[0-9a-fA-F-]{36}";

export function isAllowedProxyRequest(method: string, path: string) {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (COLLECTIONS.some((name) => clean === name)) return method === "GET" || method === "POST";
  if (COLLECTIONS.some((name) => new RegExp(`^${name}/${UUID}$`).test(clean))) return ["GET", "PATCH", "PUT", "DELETE"].includes(method);
  if (new RegExp(`^courses/${UUID}/publish$`).test(clean)) return method === "POST";
  if (new RegExp(`^course-versions/${UUID}/reorder_chapters$`).test(clean)) return method === "POST";
  if (new RegExp(`^chapters/${UUID}/reorder_subtopics$`).test(clean)) return method === "POST";
  if (new RegExp(`^subtopics/${UUID}/reorder_activities$`).test(clean)) return method === "POST";
  return false;
}
