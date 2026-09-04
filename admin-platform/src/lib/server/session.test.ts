import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
const cookieStore = {
  get: vi.fn((key: string) => values.has(key) ? { value: values.get(key) } : undefined),
  set: vi.fn((key: string, value: string) => values.set(key, value)),
  delete: vi.fn((key: string) => values.delete(key)),
};

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

describe("admin session", () => {
  beforeEach(() => { values.clear(); vi.restoreAllMocks(); process.env.DJANGO_API_URL = "http://django.test/api/v1"; });

  it("stores successful admin login tokens in HTTP-only cookies", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ access: "access", refresh: "refresh" }))
      .mockResolvedValueOnce(Response.json({ groups: ["ADMIN"] })));
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(new Request("http://admin/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b.com", password: "secret" }) }));
    expect(response.status).toBe(200);
    expect(cookieStore.set).toHaveBeenCalledWith("tella_admin_access", "access", expect.objectContaining({ httpOnly: true }));
    expect(values.get("tella_admin_refresh")).toBe("refresh");
  });

  it("rejects a valid non-admin account and clears tokens", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ access: "access", refresh: "refresh" }))
      .mockResolvedValueOnce(Response.json({ groups: ["STUDENT"] })));
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(new Request("http://admin/api/auth/login", { method: "POST", body: "{}" }));
    expect(response.status).toBe(403);
    expect(values.size).toBe(0);
  });

  it("preserves invalid credential status without creating cookies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail: "No active account" }, { status: 401 })));
    const { POST } = await import("@/app/api/auth/login/route");
    expect((await POST(new Request("http://admin/api/auth/login", { method: "POST", body: "{}" }))).status).toBe(401);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("refreshes once, rotates tokens, and retries a protected request", async () => {
    values.set("tella_admin_access", "old"); values.set("tella_admin_refresh", "refresh");
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ detail: "expired" }, { status: 401 })).mockResolvedValueOnce(Response.json({ access: "new", refresh: "rotated" })).mockResolvedValueOnce(Response.json({ id: "user" }));
    vi.stubGlobal("fetch", fetchMock);
    const { djangoRequest } = await import("./session");
    expect((await djangoRequest("auth/me/")).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(values.get("tella_admin_refresh")).toBe("rotated");
  });

  it("clears expired refresh credentials", async () => {
    values.set("tella_admin_access", "old"); values.set("tella_admin_refresh", "bad");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({}, { status: 401 })).mockResolvedValueOnce(Response.json({}, { status: 401 })));
    const { djangoRequest } = await import("./session");
    expect((await djangoRequest("auth/me/")).status).toBe(401);
    expect(values.size).toBe(0);
  });

  it("accepts a Django superuser without requiring a role assignment", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ access: "access", refresh: "refresh" }))
      .mockResolvedValueOnce(Response.json({ groups: [], is_superuser: true })));
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(new Request("http://admin/api/auth/login", { method: "POST", body: "{}" }));
    expect(response.status).toBe(200);
    expect(values.get("tella_admin_access")).toBe("access");
  });

  it("keeps learner tokens separate from the administration session", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ access: "learner-access", refresh: "learner-refresh" }))
      .mockResolvedValueOnce(Response.json({ groups: ["STUDENT"] })));
    const { POST } = await import("@/app/api/learner/auth/login/route");

    const response = await POST(new Request("http://tella/api/learner/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "learner@example.com", password: "secret" }),
    }));

    expect(response.status).toBe(200);
    expect(values.get("tella_learner_access")).toBe("learner-access");
    expect(values.get("tella_learner_refresh")).toBe("learner-refresh");
    expect(values.has("tella_admin_access")).toBe(false);
  });

  it("rejects a valid account without the student role from the learner workspace", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ access: "access", refresh: "refresh" }))
      .mockResolvedValueOnce(Response.json({ groups: ["CONTENT_MANAGER"] })));
    const { POST } = await import("@/app/api/learner/auth/login/route");

    const response = await POST(new Request("http://tella/api/learner/auth/login", { method: "POST", body: "{}" }));

    expect(response.status).toBe(403);
    expect(values.size).toBe(0);
  });
});
