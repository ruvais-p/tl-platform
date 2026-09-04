import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/people/api", () => ({ peopleApi: { studentAnalytics: vi.fn(async () => ({
  student: { id: "s", email: "leena@example.com", username: "leena", first_name: "Leena", last_name: "Rao", display_name: "Leena Rao", is_active: true, date_joined: "2026-01-01T00:00:00Z", groups: ["STUDENT"], permissions: [] },
  groups: [{ id: "g", name: "Grade 9A", grade: "9", academic_year: 2026, teacher: "Ms Shah", joined_at: "2026-01-01T00:00:00Z" }],
  summary: { assigned_courses: 1, completed_courses: 0, average_completion: 50, average_score: 72, time_spent_seconds: 3600, total_points: 25, badges_earned: 1, assessment_attempts: 1 },
  courses: [{ enrollment_id: "e", course_id: "c", course_name: "Mathematics", program_name: "Grade 9", version_name: "v1", enrollment_status: "ACTIVE", enrolled_at: "2026-01-01T00:00:00Z", started_at: null, completed_at: null, expires_at: null, status: "IN_PROGRESS", progress_percentage: 50, completed_chapters: 1, total_chapters: 2, average_score: 72, last_activity_at: "2026-01-02T00:00:00Z", chapters: [] }],
  assignments: [], badges: [{ code: "first", label: "First step", earned_at: "2026-01-01T00:00:00Z" }],
})) } }));

import { StudentAnalyticsWorkspace } from "./student-analytics-workspace";

describe("student analytics workspace", () => {
  it("renders a detailed accessible performance record", async () => {
    const { container } = render(<StudentAnalyticsWorkspace studentId="s" />);
    await screen.findByRole("heading", { name: "Leena Rao" });
    expect(screen.getByText("Mathematics")).toBeDefined();
    expect(screen.getByText("50%", { selector: "p" })).toBeDefined();
    expect((await axe(container)).violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""))).toEqual([]);
  });
});
