import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth0Session: vi.fn(),
  clearStaff: vi.fn(),
  clearLearner: vi.fn(),
  staffMethod: vi.fn(),
  learnerMethod: vi.fn(),
  staffRefresh: vi.fn(),
  learnerRefresh: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth0", () => ({ auth0: { getSession: mocks.auth0Session } }));
vi.mock("@/lib/server/session", () => ({
  clearSession: mocks.clearStaff,
  sessionAuthMethod: mocks.staffMethod,
  sessionRefreshToken: mocks.staffRefresh,
}));
vi.mock("@/lib/server/learner-session", () => ({
  clearLearnerSession: mocks.clearLearner,
  learnerAuthMethod: mocks.learnerMethod,
  learnerRefreshToken: mocks.learnerRefresh,
}));
vi.mock("@/lib/server/token-revocation", () => ({ revokeRefreshToken: mocks.revoke }));

describe("provider-aware logout routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.staffMethod.mockResolvedValue("password");
    mocks.learnerMethod.mockResolvedValue("password");
    mocks.staffRefresh.mockResolvedValue("staff-refresh");
    mocks.learnerRefresh.mockResolvedValue("learner-refresh");
    mocks.auth0Session.mockResolvedValue({ user: { sub: "auth0|1" } });
    mocks.revoke.mockResolvedValue(undefined);
  });

  it("blacklists and clears only the staff namespace for local logout", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST();
    expect(await response.json()).toEqual({ redirect_to: "/login", auth0: false });
    expect(mocks.revoke).toHaveBeenCalledWith("staff-refresh");
    expect(mocks.clearStaff).toHaveBeenCalledOnce();
    expect(mocks.clearLearner).not.toHaveBeenCalled();
    expect(mocks.auth0Session).not.toHaveBeenCalled();
  });

  it("globally clears both namespaces and returns an allowlisted Auth0 logout URL", async () => {
    mocks.staffMethod.mockResolvedValue("auth0");
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST();
    expect(await response.json()).toEqual({ redirect_to: "/auth/logout?returnTo=/login", auth0: true });
    expect(mocks.revoke).toHaveBeenCalledWith("staff-refresh");
    expect(mocks.revoke).toHaveBeenCalledWith("learner-refresh");
    expect(mocks.clearStaff).toHaveBeenCalledOnce();
    expect(mocks.clearLearner).toHaveBeenCalledOnce();
  });

  it("falls back to local clearing when an Auth0 cookie outlives its application session", async () => {
    mocks.staffMethod.mockResolvedValue("auth0");
    mocks.auth0Session.mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST();
    expect(await response.json()).toEqual({ redirect_to: "/login", auth0: false });
    expect(mocks.clearStaff).toHaveBeenCalledOnce();
    expect(mocks.clearLearner).not.toHaveBeenCalled();
  });

  it("clears learner cookies when no refresh token exists", async () => {
    mocks.learnerRefresh.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/learner/auth/logout/route");
    const response = await POST();
    expect(await response.json()).toEqual({ redirect_to: "/learn/login", auth0: false });
    expect(mocks.clearLearner).toHaveBeenCalledOnce();
  });

  it("still clears locally when the Auth0 session check fails upstream", async () => {
    mocks.learnerMethod.mockResolvedValue("auth0");
    mocks.auth0Session.mockRejectedValue(new Error("provider unavailable"));
    const { POST } = await import("@/app/api/learner/auth/logout/route");
    const response = await POST();
    expect(await response.json()).toEqual({ redirect_to: "/learn/login", auth0: false });
    expect(mocks.clearLearner).toHaveBeenCalledOnce();
    expect(mocks.clearStaff).not.toHaveBeenCalled();
  });

  it("globally logs out an Auth0 learner while blacklisting both refresh tokens", async () => {
    mocks.learnerMethod.mockResolvedValue("auth0");
    const { POST } = await import("@/app/api/learner/auth/logout/route");
    const response = await POST();
    expect(await response.json()).toEqual({ redirect_to: "/auth/logout?returnTo=/learn/login", auth0: true });
    expect(mocks.revoke).toHaveBeenCalledWith("learner-refresh");
    expect(mocks.revoke).toHaveBeenCalledWith("staff-refresh");
    expect(mocks.clearLearner).toHaveBeenCalledOnce();
    expect(mocks.clearStaff).toHaveBeenCalledOnce();
  });
});
