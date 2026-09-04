import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/courses",
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: {
      id: "staff-user",
      email: "academic@example.com",
      display_name: "Academic Manager",
      groups: ["ACADEMIC_MANAGER"],
      permissions: [
        "curriculum.view_course",
        "curriculum.add_course",
        "curriculum.add_courseversion",
        "curriculum.change_courseversion",
        "curriculum.add_chapter",
        "curriculum.change_chapter",
        "curriculum.add_subtopic",
        "curriculum.change_subtopic",
        "curriculum.add_learningactivity",
        "curriculum.change_learningactivity",
        "curriculum.publish_course",
      ],
    },
    loading: false,
    logout: vi.fn(),
  }),
}));
vi.mock("@/lib/curriculum/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/curriculum/api")>();
  return {
    ...actual,
    authApi: { ...actual.authApi, login: vi.fn() },
    curriculumApi: {
      ...actual.curriculumApi,
      courses: vi.fn(async () => []),
      programs: vi.fn(async () => []),
      course: vi.fn(async () => ({
        id: "c",
        program: "p",
        program_name: "AI",
        name: "AI Agents",
        code: "agents",
        description: "",
        status: "DRAFT",
        display_order: 0,
        versions: [
          {
            id: "v",
            course: "c",
            version_number: 1,
            name: "First version",
            status: "DRAFT",
            published_at: null,
            chapters: [
              {
                id: "ch",
                course_version: "v",
                title: "Foundations",
                slug: "foundations",
                description: "",
                chapter_number: 1,
                estimated_minutes: 10,
                is_required: true,
                status: "DRAFT",
                display_order: 0,
                completion_rule: {},
                subtopics: [
                  {
                    id: "s",
                    chapter: "ch",
                    title: "Core idea",
                    slug: "core-idea",
                    description: "",
                    learning_objectives: [],
                    estimated_minutes: 5,
                    display_order: 0,
                    is_required: true,
                    status: "DRAFT",
                    activities: [
                      {
                        id: "a",
                        subtopic: "s",
                        activity_type: "CONCEPT_VIDEO",
                        title: "Leaf lesson",
                        description: "",
                        display_order: 0,
                        is_required: true,
                        estimated_minutes: 5,
                        completion_rule: {},
                        status: "DRAFT",
                        content: null,
                        content_record: null,
                        experiment: null,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })),
    },
  };
});
import LoginPage from "@/app/login/page";
import { CourseLibrary } from "./course-library";
import { CurriculumEditor } from "./curriculum-editor";
import LearnerLoginPage from "@/app/learn/login/page";

afterEach(cleanup);

describe("administration accessibility", () => {
  beforeEach(() => push.mockClear());
  it("has no serious sign-in violations", async () => {
    const { container } = render(<LoginPage />);
    expect(
      (await axe(container)).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
  });
  it("labels the course library empty state and actions", async () => {
    const { container } = render(<CourseLibrary />);
    await screen.findByText("No courses yet");
    expect(
      screen.getAllByRole("button", { name: /new course/i }).length,
    ).toBeGreaterThan(0);
    expect(
      (await axe(container)).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
  });
  it("labels the required program selector in the course dialog", async () => {
    render(<CourseLibrary />);
    await screen.findByText("No courses yet");
    fireEvent.click(screen.getAllByRole("button", { name: /new course/i })[0]);
    await screen.findByRole("dialog");
    const program = screen.getByRole("combobox", { name: "Program" });
    expect(program.getAttribute("aria-required")).toBe("true");
    expect(screen.getByText("Select a program…")).toBeDefined();
  });
  it("exposes the editor hierarchy as a named region", async () => {
    const { container } = render(<CurriculumEditor courseId="c" />);
    await screen.findByText("Course structure");
    expect(
      screen.getByRole("region", { name: "Course hierarchy" }),
    ).toBeDefined();
    await screen.findByText("Leaf lesson");
    expect(
      screen.queryByRole("button", { name: /collapse leaf lesson/i }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("button", { name: "Move Leaf lesson up" }) as
          | HTMLButtonElement
          | undefined
      )?.disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", { name: "Move Leaf lesson down" }) as
          | HTMLButtonElement
          | undefined
      )?.disabled,
    ).toBe(true);
    expect(
      (await axe(container)).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
  });
  it("has no serious learner sign-in violations", async () => {
    const { container } = render(<LearnerLoginPage />);
    expect(
      screen.getByText(/^welcome back$/i),
    ).toBeDefined();
    expect(
      (await axe(container)).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
  });
});
