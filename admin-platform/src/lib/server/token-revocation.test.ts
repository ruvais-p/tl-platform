import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getApiBaseUrl: () => "https://django.test/api/v1" }));

describe("refresh-token revocation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("does nothing when no refresh token is available", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { revokeRefreshToken } = await import("./token-revocation");
    await revokeRefreshToken();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose an expired access token and tolerates backend failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("backend unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const { revokeRefreshToken } = await import("./token-revocation");
    await expect(revokeRefreshToken("refresh-token")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("https://django.test/api/v1/auth/logout/", expect.objectContaining({
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({ refresh: "refresh-token" }),
    }));
    expect(new Headers(fetchMock.mock.calls[0][1].headers).has("authorization")).toBe(false);
  });
});
