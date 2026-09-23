import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ middleware: vi.fn(), enabled: false }));

vi.mock("@/lib/auth0", () => ({
  get auth0() {
    return mocks.enabled ? { middleware: mocks.middleware } : null;
  },
}));

describe("Auth0 proxy", () => {
  beforeEach(() => {
    mocks.enabled = false;
    mocks.middleware.mockReset();
  });

  it("passes application and Django proxy routes through when Auth0 is disabled", async () => {
    const { proxy } = await import("./proxy");
    const response = await proxy(new Request("https://platform.test/api/staff/courses") as never);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.middleware).not.toHaveBeenCalled();
  });

  it("delegates mounted Auth0 routes to the SDK middleware when enabled", async () => {
    const expected = new Response(null, { status: 204 });
    mocks.enabled = true;
    mocks.middleware.mockResolvedValue(expected);
    const { proxy } = await import("./proxy");
    expect(await proxy(new Request("https://platform.test/auth/login") as never)).toBe(expected);
    expect(mocks.middleware).toHaveBeenCalledOnce();
  });

  it("excludes framework and public logo assets from its matcher", async () => {
    const { config } = await import("./proxy");
    expect(config.matcher[0]).toContain("_next/static");
    expect(config.matcher[0]).toContain("_next/image");
    expect(config.matcher[0]).toContain("logo.png");
  });
});
