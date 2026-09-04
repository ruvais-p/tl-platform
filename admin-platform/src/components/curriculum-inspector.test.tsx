import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CurriculumInspector } from "./curriculum-inspector";
import type { Activity, Course } from "@/lib/curriculum/types";

const api = vi.hoisted(() => ({ update: vi.fn(), saveContent: vi.fn(), remove: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/curriculum/api", async original => ({ ...(await original<typeof import("@/lib/curriculum/api")>()), curriculumApi: api }));

afterEach(cleanup);
beforeEach(() => { Object.values(api).forEach(mock => mock.mockReset()); api.update.mockResolvedValue({}); api.saveContent.mockResolvedValue({}); });

const activity: Activity = { id: "activity-1", subtopic: "subtopic-1", activity_type: "READING", title: "Read", description: "Learn", display_order: 0, is_required: true, estimated_minutes: 5, completion_rule: { complete: true, custom: "keep" }, status: "DRAFT", content: { title: "Hello" }, content_record: { id: "content-1", activity: "activity-1", content_type: "application/json", content: { title: "Hello" }, created_at: "", updated_at: "" }, experiment: null };
const course = { id: "course-1", program: "program-1", program_name: "Program", name: "Course", code: "course", description: "", status: "DRAFT", display_order: 0, versions: [] } as Course;

function view() { return render(<CurriculumInspector course={course} selection={{ kind: "activity", id: activity.id }} resource={activity} canPublish={false} onDirty={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} onError={vi.fn()} />); }

describe("CurriculumInspector", () => {
  it("does not mutate either endpoint with unapplied raw JSON", async () => {
    const user = userEvent.setup(); view();
    const advanced = screen.getAllByRole("button", { name: "Advanced JSON" }); await user.click(advanced[1]);
    fireEvent.change(screen.getByLabelText("Structured activity content raw JSON"), { target: { value: "{" } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(api.update).not.toHaveBeenCalled(); expect(api.saveContent).not.toHaveBeenCalled(); expect(screen.getByText(/Apply or reset/)).toBeDefined();
  });

  it("uses the content record identity and recovers from a partial save", async () => {
    const user = userEvent.setup(); api.saveContent.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({}); view();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.saveContent).toHaveBeenCalledWith("activity-1", activity.content_record, "application/json", { title: "Hello" });
    expect(screen.getByText(/Activity fields were saved/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Retry content save" }));
    await waitFor(() => expect(api.saveContent).toHaveBeenCalledTimes(2)); expect(api.update).toHaveBeenCalledTimes(1);
  });

  it("exposes a bounded responsive workspace without serious accessibility violations", async () => {
    const { container } = view(); const form = container.querySelector("form"); const actions = container.querySelector(".fixed.inset-x-0");
    expect(form?.className).toContain("max-w-4xl"); expect(form?.className).toContain("pb-28"); expect(actions?.className).toContain("lg:static");
    expect((await axe(container)).violations.filter(issue => ["serious", "critical"].includes(issue.impact || ""))).toEqual([]);
  });
});
