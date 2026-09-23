import { describe, expect, it } from "vitest";

import { canSee, navigation, roleName } from "@/components/admin-shell";

describe("support chat staff navigation", () => {
  const item = navigation.find((entry) => entry.href === "/chats")!;

  it("shows Chats to assigned teachers and global academic managers", () => {
    expect(canSee(item, ["tutoring.reply_to_assigned_course_support_chats"])).toBe(true);
    expect(canSee(item, ["tutoring.view_all_course_support_chats"])).toBe(true);
  });

  it("hides Chats from ordinary administrators and labels teachers", () => {
    expect(canSee(item, ["curriculum.view_course", "accounts.manage_users"])).toBe(false);
    expect(roleName(["TEACHER"])).toBe("Teacher");
  });
});
