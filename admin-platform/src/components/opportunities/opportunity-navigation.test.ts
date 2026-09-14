import { describe, expect, it } from "vitest";

import { canSee, navigation } from "@/components/admin-shell";
import { modules } from "@/components/staff/staff-dashboard";

describe("opportunity navigation", () => {
  it("shows the dedicated workspace only with view permission", () => {
    const item = navigation.find((entry) => entry.href === "/opportunities");
    expect(item).toBeDefined();
    expect(canSee(item!, ["progress.view_careeropportunity"])).toBe(true);
    expect(canSee(item!, ["curriculum.view_course"])).toBe(false);
  });

  it("adds a dedicated dashboard module", () => {
    expect(modules.find((module) => module.href === "/opportunities")?.permissions).toEqual([
      "progress.view_careeropportunity",
    ]);
  });
});
