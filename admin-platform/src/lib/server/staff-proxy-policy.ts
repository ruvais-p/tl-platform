const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const INTEGER = "[0-9]+";

const CRUD_COLLECTIONS = new Set([
  "programs",
  "courses",
  "course-versions",
  "chapters",
  "subtopics",
  "activities",
  "activity-content",
  "videos",
  "experiments",
  "practice-sets",
  "practice-items",
  "media-assets",
  "student-groups",
  "student-group-members",
  "enrollments",
  "course-assignments",
  "external-user-mappings",
  "questions",
  "question-options",
  "case-studies",
  "case-study-questions",
  "learning-checks",
  "learning-check-questions",
  "career-opportunities",
  "workshop-configs",
]);

const READ_ONLY_COLLECTIONS = new Set([
  "activity-progress-records",
  "assessment-attempts",
  "assessment-answers",
  "point-events",
  "badge-awards",
  "legacy-assessment-attempts",
  "staff-workshop-models",
]);

function matchesDetail(path: string, collection: string, idPattern = UUID) {
  return new RegExp(`^${collection}/${idPattern}$`).test(path);
}

export function isAllowedStaffProxyRequest(method: string, path: string) {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (!clean || clean.includes("..") || clean.includes("\\")) return false;

  if (CRUD_COLLECTIONS.has(clean)) return method === "GET" || method === "POST";
  if (
    [...CRUD_COLLECTIONS].some((collection) => matchesDetail(clean, collection))
  ) {
    return ["GET", "PATCH", "PUT"].includes(method);
  }

  if (READ_ONLY_COLLECTIONS.has(clean)) return method === "GET";
  if (
    [...READ_ONLY_COLLECTIONS].some((collection) =>
      matchesDetail(clean, collection),
    )
  ) {
    return method === "GET";
  }

  if (clean === "students") return method === "GET";
  if (matchesDetail(clean, "students")) return method === "GET";

  if (clean === "auth/users") return method === "GET" || method === "POST";
  if (matchesDetail(clean, "auth/users")) {
    return ["GET", "PATCH", "PUT"].includes(method);
  }
  if (clean === "auth/groups") return method === "GET";
  if (matchesDetail(clean, "auth/groups", INTEGER)) return method === "GET";
  if (new RegExp(`^auth/groups/${INTEGER}/permissions$`).test(clean)) {
    return method === "PATCH" || method === "PUT";
  }
  if (clean === "auth/permissions") return method === "GET";
  if (clean === "auth/staff-summary") return method === "GET";

  if (new RegExp(`^student-groups/${UUID}/members$`).test(clean))
    return method === "POST";
  if (new RegExp(`^practice-sets/${UUID}/reorder_items$`).test(clean))
    return method === "POST";
  if (new RegExp(`^courses/${UUID}/(publish|duplicate)$`).test(clean))
    return method === "POST";
  if (new RegExp(`^course-versions/${UUID}/reorder_chapters$`).test(clean))
    return method === "POST";
  if (new RegExp(`^chapters/${UUID}/reorder_subtopics$`).test(clean))
    return method === "POST";
  if (new RegExp(`^subtopics/${UUID}/reorder_activities$`).test(clean))
    return method === "POST";

  return false;
}
