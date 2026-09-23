import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LearnerCourseLayout from "@/app/learn/(app)/courses/[courseId]/layout";

vi.mock("@/components/learner/course-support-chat", () => ({
  CourseSupportChat: ({ courseId }: { courseId: string }) => <button data-course={courseId}>Ask a teacher</button>,
}));
vi.mock("@/components/learner/course-chatbot", () => ({
  CourseChatbot: ({ courseId }: { courseId: string }) => <button data-course={courseId}>Ask course tutor</button>,
}));

afterEach(cleanup);

describe("learner course support placement", () => {
  it("mounts teacher support before the AI tutor on the shared course route", async () => {
    render(await LearnerCourseLayout({ children: <div>Course content</div>, params: Promise.resolve({ courseId: "course-1" }) }));
    const teacher = screen.getByRole("button", { name: "Ask a teacher" });
    const tutor = screen.getByRole("button", { name: "Ask course tutor" });
    expect(teacher.compareDocumentPosition(tutor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(teacher.getAttribute("data-course")).toBe("course-1");
  });
});
