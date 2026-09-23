export type AuthPortal = "staff" | "learner";

const STAFF_PATHS = [
  "/dashboard",
  "/access",
  "/assessments",
  "/content",
  "/courses",
  "/learners",
  "/manage",
  "/media",
  "/operations",
  "/opportunities",
  "/people",
  "/student-groups",
];

export function parsePortal(value: string | null): AuthPortal | null {
  return value === "staff" || value === "learner" ? value : null;
}

export function defaultContinuation(portal: AuthPortal) {
  return portal === "learner" ? "/learn" : "/dashboard";
}

function pathMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function safeContinuation(portal: AuthPortal, candidate?: string | null) {
  const fallback = defaultContinuation(portal);
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  try {
    decodeURI(candidate);
    const resolved = new URL(candidate, "https://platform.invalid");
    if (resolved.origin !== "https://platform.invalid") return fallback;
    const allowed = portal === "learner"
      ? pathMatches(resolved.pathname, "/learn") && !pathMatches(resolved.pathname, "/learn/login")
      : STAFF_PATHS.some((prefix) => pathMatches(resolved.pathname, prefix));
    return allowed ? `${resolved.pathname}${resolved.search}${resolved.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function auth0LoginUrl(portal: AuthPortal, candidate?: string | null) {
  const completion = new URL("https://platform.invalid/auth/complete");
  completion.searchParams.set("portal", portal);
  completion.searchParams.set("next", safeContinuation(portal, candidate));
  const params = new URLSearchParams({
    returnTo: `${completion.pathname}${completion.search}`,
  });
  return `/auth/login?${params}`;
}
