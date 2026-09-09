import { afterEach, describe, expect, it, vi } from "vitest";
import { learnerApi } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("learner chatbot client", () => {
  it("posts a first message without inventing a session", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      session_id: "session-1",
      reply: "A grounded response.",
      citations: [],
      refused: false,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await learnerApi.sendCourseChat("123e4567-e89b-12d3-a456-426614174000", "What is a vector?");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/learner/data/courses/123e4567-e89b-12d3-a456-426614174000/chat",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ message: "What is a vector?" }) }),
    );
  });

  it("continues only the session returned by the backend", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      session_id: "session-1",
      reply: "A grounded response.",
      citations: [],
      refused: false,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await learnerApi.sendCourseChat("course-1", "Continue", "session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/learner/data/courses/course-1/chat",
      expect.objectContaining({ body: JSON.stringify({ message: "Continue", session_id: "session-1" }) }),
    );
  });
});
