import { afterEach, describe, expect, it, vi } from "vitest";

import { learnerApi } from "@/lib/learner/api";
import { staffOpportunityApi } from "./staff-api";

afterEach(() => vi.unstubAllGlobals());

describe("opportunity API clients", () => {
  it("serializes combined staff filters", async () => {
    const fetchMock = vi.fn(async (...request: [RequestInfo | URL, RequestInit?]) => { void request; return Response.json([]); });
    vi.stubGlobal("fetch", fetchMock);
    await staffOpportunityApi.list({ search: "analyst", workplace_mode: "REMOTE" });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/staff/career-opportunities?search=analyst&workplace_mode=REMOTE",
    );
  });

  it("submits learner applications as multipart form data", async () => {
    const fetchMock = vi.fn(async (...request: [RequestInfo | URL, RequestInit?]) => { void request; return Response.json({ id: "application-1" }); });
    vi.stubGlobal("fetch", fetchMock);
    const resume = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    await learnerApi.apply("opportunity-1", { contact_phone: "12345", cover_note: "Hello", resume });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/learner/data/career/opportunities/opportunity-1/applications",
    );
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
  });

  it("uses explicit lifecycle and application transition routes", async () => {
    const fetchMock = vi.fn(async (...request: [RequestInfo | URL, RequestInit?]) => { void request; return Response.json({ id: "record-1" }); });
    vi.stubGlobal("fetch", fetchMock);
    await staffOpportunityApi.lifecycle("opportunity-1", "publish");
    await staffOpportunityApi.transition("application-1", "SHORTLISTED");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/staff/career-opportunities/opportunity-1/publish",
      "/api/staff/opportunity-applications/application-1/transition",
    ]);
  });
});
