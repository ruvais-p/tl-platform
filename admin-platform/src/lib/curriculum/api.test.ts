import { afterEach, describe, expect, it, vi } from "vitest";
import { curriculumApi } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("typed curriculum client", () => {
  it("creates draft programs through the curriculum proxy", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => Response.json(JSON.parse(String(init?.body))));
    vi.stubGlobal("fetch", fetchMock);
    const program = await curriculumApi.createProgram({ name: "Science", code: "science", status: "DRAFT" });
    expect(program).toMatchObject({ name: "Science", code: "science", status: "DRAFT" });
    expect(fetchMock).toHaveBeenCalledWith("/api/curriculum/programs", expect.objectContaining({ method: "POST" }));
  });

  it("round-trips extended content without dropping unknown keys", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => Response.json(JSON.parse(String(init?.body))));
    vi.stubGlobal("fetch", fetchMock);
    const content = { title: "Overview", facilitation: { prompt: "Discuss" }, future_field: { kept: true } };
    const result = await curriculumApi.saveContent("activity", null, "application/json", content);
    expect(result.content).toEqual(content);
    expect(fetchMock).toHaveBeenCalledWith("/api/curriculum/activity-content", expect.objectContaining({ method: "POST" }));
  });

  it("creates an admin-driven experiment without dropping extension fields", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => Response.json({
      id: "experiment",
      activity: "activity",
      created_at: "now",
      updated_at: "now",
      ...JSON.parse(String(init?.body)),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const configuration = {
      schema_version: 1,
      renderer: "placeholder",
      renderer_config: { message: "Supplied by an administrator" },
      future_extension: { kept: true },
    };

    const result = await curriculumApi.saveExperiment("activity", null, {
      experiment_type: "SIMULATION",
      instructions: "Admin supplied instructions",
      configuration,
      external_url: null,
    });

    expect(result.configuration).toEqual(configuration);
    expect(fetchMock).toHaveBeenCalledWith("/api/curriculum/experiments", expect.objectContaining({ method: "POST" }));
  });

  it("preserves permission errors for the editor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail: "You do not have permission." }, { status: 403 })));
    await expect(curriculumApi.update("activities", "id", { title: "Unsaved" })).rejects.toMatchObject({ status: 403 });
  });

  it("does not invent success after rejected publication", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Program must be published." } }, { status: 400 })));
    await expect(curriculumApi.publish("course", "version")).rejects.toThrow("Program must be published.");
  });

  it("loads and saves version-specific chatbot configuration", async () => {
    const config = {
      id: "config-1",
      course_version: "version-1",
      is_enabled: false,
      approved_context: "Approved lesson text",
      context_revision: 1,
      updated_at: "2026-09-09T00:00:00Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([config]))
      .mockResolvedValueOnce(Response.json({ ...config, is_enabled: true, context_revision: 2 }));
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await curriculumApi.chatbotConfig("version-1");
    await curriculumApi.saveChatbotConfig("version-1", loaded, {
      is_enabled: true,
      approved_context: "Approved lesson text",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/curriculum/course-chatbot-configs?course_version=version-1", expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/curriculum/course-chatbot-configs/config-1", expect.objectContaining({ method: "PATCH" }));
  });
});
