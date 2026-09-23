import { describe, expect, it } from "vitest";

import { mergeSupportMessages, reduceSupportEvent } from "./reducer";
import type { SupportConversation, SupportMessage } from "./types";

const person = { id: "user-1", email: "learner@example.com", first_name: "Leena", last_name: "Rao" };
const conversation: SupportConversation = {
  id: "conversation-1",
  student: person,
  course: { id: "course-1", name: "Physics", code: "PHY" },
  course_version: { id: "version-1", name: "2026", version_number: 1 },
  groups: [],
  status: "OPEN",
  last_sequence: 0,
  last_message_at: null,
  last_message: null,
  unread_count: 0,
  can_send: true,
  can_close: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const message = (id: string, sequence: number): SupportMessage => ({
  id,
  conversation: conversation.id,
  sender: person,
  sender_role: "STUDENT",
  sequence,
  client_message_id: `client-${id}`,
  content: `Message ${sequence}`,
  created_at: `2026-01-01T00:00:0${sequence}Z`,
});

describe("support chat event reducer", () => {
  it("deduplicates and orders durable messages", () => {
    expect(mergeSupportMessages([message("two", 2)], [message("one", 1), message("two", 2)]).map((row) => row.id)).toEqual([
      "one",
      "two",
    ]);
  });

  it("merges broadcasts and acknowledgements without duplicating a send", () => {
    const initial = { conversations: [conversation], messages: {}, readSequences: {} };
    const accepted = reduceSupportEvent(initial, {
      v: 1,
      type: "message.accepted",
      request_id: "request-1",
      created: true,
      message: message("one", 1),
    });
    const broadcast = reduceSupportEvent(accepted, {
      v: 1,
      type: "message.created",
      conversation: { id: conversation.id, last_sequence: 1 },
      message: message("one", 1),
    });

    expect(broadcast.messages[conversation.id]).toHaveLength(1);
    expect(broadcast.conversations[0].last_sequence).toBe(1);
  });

  it("never moves a local read cursor backwards", () => {
    const state = { conversations: [conversation], messages: {}, readSequences: { [conversation.id]: 4 } };
    const next = reduceSupportEvent(state, {
      v: 1,
      type: "conversation.read.updated",
      conversation_id: conversation.id,
      sequence: 2,
    });
    expect(next.readSequences[conversation.id]).toBe(4);
  });
});
