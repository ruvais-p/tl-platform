import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseChatbotPanel } from "./course-chatbot-panel";
import type { CourseChatbotConfig, CourseVersion } from "@/lib/curriculum/types";

const api = vi.hoisted(() => ({ chatbotConfig: vi.fn(), saveChatbotConfig: vi.fn() }));
vi.mock("@/lib/curriculum/api", async (original) => ({
  ...(await original<typeof import("@/lib/curriculum/api")>()),
  curriculumApi: api,
}));

const version = {
  id: "version-1",
  course: "course-1",
  version_number: 1,
  name: "Version 1",
  status: "DRAFT",
  published_at: null,
  chapters: [],
} as CourseVersion;

const config: CourseChatbotConfig = {
  id: "config-1",
  course_version: version.id,
  is_enabled: false,
  approved_context: "Vectors have magnitude and direction.",
  context_revision: 1,
  updated_by: "staff-1",
  created_at: "2026-09-09T00:00:00Z",
  updated_at: "2026-09-09T00:00:00Z",
};

afterEach(cleanup);
beforeEach(() => {
  api.chatbotConfig.mockReset().mockResolvedValue(config);
  api.saveChatbotConfig.mockReset().mockResolvedValue({ ...config, is_enabled: true, context_revision: 2 });
});

describe("CourseChatbotPanel", () => {
  it("does not load or expose controls without permission", () => {
    render(<CourseChatbotPanel version={version} canManage={false} />);
    expect(screen.queryByRole("heading", { name: "Course chatbot" })).toBeNull();
    expect(api.chatbotConfig).not.toHaveBeenCalled();
  });

  it("loads and independently saves the selected version configuration", async () => {
    const user = userEvent.setup();
    render(<CourseChatbotPanel version={version} canManage />);
    expect(await screen.findByDisplayValue(config.approved_context)).toBeDefined();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save chatbot settings" }));

    await waitFor(() => expect(api.saveChatbotConfig).toHaveBeenCalledWith(
      version.id,
      config,
      { is_enabled: true, approved_context: config.approved_context },
    ));
    expect(await screen.findByText("Course chatbot enabled with the approved context.")).toBeDefined();
  });

  it("refuses to enable without approved context", async () => {
    api.chatbotConfig.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    render(<CourseChatbotPanel version={version} canManage />);
    await screen.findByLabelText("Approved context");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save chatbot settings" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Approved context is required");
    expect(api.saveChatbotConfig).not.toHaveBeenCalled();
  });
});
