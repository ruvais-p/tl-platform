import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/people/api", () => ({ peopleApi: {
  people: vi.fn(async () => [{ id: "p", email: "learner@example.com", username: "learner", first_name: "Leena", last_name: "Rao", display_name: "Leena Rao", is_active: true, date_joined: "", groups: ["STUDENT"], permissions: [] }]),
  roles: vi.fn(async () => [{ value: "STUDENT", label: "Student", protected: false }]),
  create: vi.fn(), update: vi.fn(),
} }));

import { PeopleWorkspace } from "./people-workspace";

describe("people workspace", () => {
  it("shows the people directory and accessible resource charts", async () => {
    const { container } = render(<PeopleWorkspace />);
    await screen.findByText("Leena Rao");
    expect(screen.getByRole("heading", { name: "Human resources" })).toBeDefined();
    expect(screen.getByRole("img", { name: /people by role/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /add person/i })).toBeDefined();
    expect((await axe(container)).violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""))).toEqual([]);
  });
});
