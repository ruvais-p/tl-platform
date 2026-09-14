import "server-only";

import { getApiBaseUrl } from "@/lib/env";

export async function revokeRefreshToken(refresh?: string) {
  if (!refresh) return;
  try {
    await fetch(`${getApiBaseUrl()}/auth/logout/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
  } catch {
    // Local cookie clearing must not depend on backend or provider availability.
  }
}
