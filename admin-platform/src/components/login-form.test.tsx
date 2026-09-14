import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import { LearnerLoginForm } from "./learner/learner-login-form";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
  staffLogin: vi.fn(),
  learnerLogin: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@/lib/curriculum/api", () => ({
  ApiError: class ApiError extends Error {},
  authApi: { login: mocks.staffLogin },
}));
vi.mock("@/lib/learner/api", () => ({
  LearnerApiError: class LearnerApiError extends Error {},
  learnerAuthApi: { login: mocks.learnerLogin },
}));
vi.mock("./learner/brand", () => ({ LearnerBrand: () => <div role="img" aria-label="Sofia Systems" /> }));

describe("dual authentication login forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = new URLSearchParams();
    mocks.staffLogin.mockResolvedValue(undefined);
    mocks.learnerLogin.mockResolvedValue(undefined);
  });

  it("offers keyboard-accessible Auth0 and password controls to staff", async () => {
    mocks.params = new URLSearchParams("next=/opportunities/12");
    render(<LoginForm auth0Available />);
    const auth0Link = screen.getByRole("link", { name: /continue with auth0/i });
    expect(auth0Link.getAttribute("href")).toContain("portal%3Dstaff");
    expect(screen.getByRole("textbox", { name: /email address/i })).not.toBeNull();
    await userEvent.type(screen.getByLabelText(/email address/i), "admin@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(mocks.staffLogin).toHaveBeenCalledWith("admin@example.com", "secret");
    expect(mocks.replace).toHaveBeenCalledWith("/opportunities/12");
  });

  it("does not expose Auth0 when it is disabled", () => {
    render(<LoginForm />);
    expect(screen.queryByRole("link", { name: /continue with auth0/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^sign in$/i })).not.toBeNull();
  });

  it("offers both methods to learners, constrains continuation, and remains accessible", async () => {
    mocks.params = new URLSearchParams("next=/dashboard");
    const { container } = render(<LearnerLoginForm auth0Available />);
    const auth0Link = screen.getByRole("link", { name: /continue with auth0/i });
    expect(auth0Link.getAttribute("href")).toContain("portal%3Dlearner");
    expect(auth0Link.getAttribute("href")).toContain("next%3D%252Flearn");
    expect(screen.getByText(/automatically through Moodle/i)).not.toBeNull();
    await userEvent.type(screen.getByLabelText(/email address/i), "student@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(mocks.learnerLogin).toHaveBeenCalledWith("student@example.com", "secret");
    expect(mocks.replace).toHaveBeenCalledWith("/learn");
    expect((await axe(container)).violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""))).toEqual([]);
  });

  it("shows a generic provider error without provider details", () => {
    mocks.params = new URLSearchParams("auth0_error=secret-upstream-detail");
    render(<LearnerLoginForm auth0Available />);
    expect(screen.getByRole("alert").textContent).toContain("could not be completed");
    expect(screen.getByRole("alert").textContent).not.toContain("secret-upstream-detail");
  });
});
