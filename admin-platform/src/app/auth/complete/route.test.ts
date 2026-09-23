import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAccessToken: vi.fn(),
  clearStaff: vi.fn(),
  clearLearner: vi.fn(),
  setStaff: vi.fn(),
  setLearner: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: mocks.getSession, getAccessToken: mocks.getAccessToken },
  auth0Audience: "https://api.platform.test",
}));
vi.mock("@/lib/env", () => ({ getApiBaseUrl: () => "https://django.test/api/v1" }));
vi.mock("@/lib/server/session", () => ({ clearSession: mocks.clearStaff, setSession: mocks.setStaff }));
vi.mock("@/lib/server/learner-session", () => ({ clearLearnerSession: mocks.clearLearner, setLearnerSession: mocks.setLearner }));

describe("Auth0 completion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mocks.getAccessToken.mockResolvedValue({ token: "provider-assertion" });
  });

  it.each([
    ["staff", "/opportunities/42", { staff: true, learner: false }, mocks.setStaff, mocks.setLearner],
    ["learner", "/learn/courses/42", { staff: false, learner: true }, mocks.setLearner, mocks.setStaff],
  ] as const)("exchanges and stores a %s session only in its cookie namespace", async (portal, destination, access, setter, otherSetter) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access: "platform-access", refresh: "platform-refresh", user: { id: "user-1", portal_access: access } })));
    const { GET } = await import("./route");
    const response = await GET(new Request(`https://platform.test/auth/complete?portal=${portal}&next=${encodeURIComponent(destination)}`));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`https://platform.test${destination}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(setter).toHaveBeenCalledWith(expect.objectContaining({ access: "platform-access" }), "auth0");
    expect(otherSetter).not.toHaveBeenCalled();
    const request = vi.mocked(fetch).mock.calls[0];
    expect(request[0]).toBe("https://django.test/api/v1/auth/auth0/exchange/");
    expect(JSON.parse(String(request[1]?.body))).toEqual({ assertion: "provider-assertion", portal });
    expect(response.headers.get("location")).not.toContain("provider-assertion");
  });

  it("clears a partial session when Django denies the account", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail: "Authentication could not be completed." }, { status: 403 })));
    const { GET } = await import("./route");
    const response = await GET(new Request("https://platform.test/auth/complete?portal=staff&next=/dashboard"));
    expect(mocks.clearStaff).toHaveBeenCalledOnce();
    expect(mocks.setStaff).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://platform.test/login?auth0_error=access_denied");
    expect(await response.text()).not.toContain("Authentication could not be completed");
  });

  it("rejects canonical user context without access to the requested portal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access: "a", refresh: "r", user: { id: "user-1", portal_access: { staff: false } } })));
    const { GET } = await import("./route");
    const response = await GET(new Request("https://platform.test/auth/complete?portal=staff&next=/dashboard"));
    expect(mocks.clearStaff).toHaveBeenCalledOnce();
    expect(mocks.setStaff).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("auth0_error=access_denied");
  });

  it("handles a missing Auth0 application session without contacting Django", async () => {
    mocks.getSession.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");
    const response = await GET(new Request("https://platform.test/auth/complete?portal=learner&next=/learn"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.clearLearner).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toContain("/learn/login?auth0_error=access_denied");
  });

  it("uses a fixed destination and generic error when provider exchange fails", async () => {
    mocks.getAccessToken.mockRejectedValue(new Error("secret upstream detail"));
    const { GET } = await import("./route");
    const response = await GET(new Request("https://platform.test/auth/complete?portal=staff&next=https://attacker.example"));
    expect(mocks.clearStaff).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe("https://platform.test/login?auth0_error=unavailable");
    expect(await response.text()).not.toContain("secret upstream detail");
  });
});
