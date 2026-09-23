import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SupportConversation, SupportMessage, SupportServerEvent } from "@/lib/support-chat/types";
import { SupportChatWorkspace } from "./support-chat-workspace";

const auth = vi.hoisted(() => ({
  user: {
    id: "teacher-1",
    display_name: "Mira Sen",
    permissions: ["tutoring.reply_to_assigned_course_support_chats", "tutoring.close_course_support_chats"],
  } as { id: string; display_name: string; permissions: string[] } | null,
}));
const api = vi.hoisted(() => ({
  conversations: vi.fn(),
  messages: vi.fn(),
  markRead: vi.fn(),
  ticket: vi.fn(),
  close: vi.fn(),
}));
const socket = vi.hoisted(() => ({
  sendResult: true,
  send: vi.fn(),
  emit: undefined as ((event: SupportServerEvent) => void) | undefined,
}));

vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("@/lib/support-chat/api", async (original) => ({
  ...(await original<typeof import("@/lib/support-chat/api")>()),
  supportChatApi: api,
}));
vi.mock("@/lib/support-chat/socket-client", () => ({
  SupportSocketClient: class {
    constructor(
      _ticket: unknown,
      onEvent: (event: SupportServerEvent) => void,
      private onState: (state: "idle" | "live") => void,
    ) { socket.emit = onEvent; }
    connect() { this.onState("live"); }
    disconnect() { this.onState("idle"); }
    send(command: unknown) { socket.send(command); return socket.sendResult; }
  },
}));

const learner = { id: "student-1", email: "leena@example.com", first_name: "Leena", last_name: "Rao" };
const conversation: SupportConversation = {
  id: "conversation-1",
  student: learner,
  course: { id: "course-1", name: "Physics", code: "PHY" },
  course_version: { id: "version-1", name: "Term 1", version_number: 1 },
  groups: [{ id: "group-1", name: "Grade 9", code: "G9" }],
  status: "OPEN",
  last_sequence: 1,
  last_message_at: "2026-09-22T10:00:00Z",
  last_message: null,
  unread_count: 1,
  can_send: true,
  can_close: true,
  created_at: "2026-09-22T10:00:00Z",
  updated_at: "2026-09-22T10:00:00Z",
};
const learnerMessage: SupportMessage = {
  id: "message-1",
  conversation: conversation.id,
  sender: learner,
  sender_role: "STUDENT",
  sequence: 1,
  client_message_id: "client-1",
  content: "I need help with motion.",
  created_at: "2026-09-22T10:00:00Z",
};

beforeEach(() => {
  auth.user = { id: "teacher-1", display_name: "Mira Sen", permissions: ["tutoring.reply_to_assigned_course_support_chats", "tutoring.close_course_support_chats"] };
  api.conversations.mockReset().mockResolvedValue({ next: null, previous: null, results: [conversation] });
  api.messages.mockReset().mockResolvedValue({ results: [learnerMessage], has_more: false, next_after_sequence: 1 });
  api.markRead.mockReset().mockResolvedValue({ conversation_id: conversation.id, sequence: 1 });
  api.close.mockReset().mockResolvedValue({ ...conversation, status: "CLOSED" });
  api.ticket.mockReset();
  socket.send.mockReset();
  socket.sendResult = true;
  socket.emit = undefined;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("SupportChatWorkspace", () => {
  it("denies a direct visit without a chat permission", () => {
    auth.user = { id: "admin-1", display_name: "Ordinary Admin", permissions: ["curriculum.view_course"] };
    render(<SupportChatWorkspace />);
    expect(screen.getByText(/do not have permission/)).toBeDefined();
    expect(api.conversations).not.toHaveBeenCalled();
  });

  it("loads the permission-scoped inbox and selected persisted thread", async () => {
    render(<SupportChatWorkspace />);
    expect((await screen.findAllByText("Leena Rao")).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Open conversation with Leena Rao" }));
    expect(await screen.findByText(learnerMessage.content)).toBeDefined();
    expect(api.conversations).toHaveBeenCalledWith();
    expect(api.messages).toHaveBeenCalledWith("staff", conversation.id, 0);
    expect(api.markRead).toHaveBeenCalledWith("staff", conversation.id, 1);
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
  });

  it("filters conversations by learner and course", async () => {
    render(<SupportChatWorkspace />);
    await screen.findAllByText("Leena Rao");
    await userEvent.type(screen.getByLabelText("Search chats"), "chemistry");
    expect(screen.getByText("No conversations match these filters.")).toBeDefined();
    await userEvent.clear(screen.getByLabelText("Search chats"));
    await userEvent.type(screen.getByLabelText("Search chats"), "physics");
    expect(screen.queryByText("No conversations match these filters.")).toBeNull();
  });

  it("keeps replies pending until acknowledgement and merges the durable message", async () => {
    render(<SupportChatWorkspace />);
    await userEvent.click(await screen.findByRole("button", { name: "Open conversation with Leena Rao" }));
    await userEvent.type(await screen.findByLabelText("Reply to learner"), "Let us work through it.");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect(screen.getByText("Sending…")).toBeDefined();
    const command = socket.send.mock.calls.at(-1)?.[0] as { request_id: string; client_message_id: string };
    await act(async () => socket.emit?.({
      v: 1,
      type: "message.accepted",
      request_id: command.request_id,
      created: true,
      message: {
        ...learnerMessage,
        id: "message-2",
        sequence: 2,
        client_message_id: command.client_message_id,
        content: "Let us work through it.",
        sender: { id: "teacher-1", email: "teacher@example.com", first_name: "Mira", last_name: "Sen" },
        sender_role: "TEACHER",
      },
    }));
    expect(screen.queryByText("Sending…")).toBeNull();
    expect(screen.getByLabelText("Your message")).toBeDefined();
  });

  it("closes a conversation and applies a later real-time reopen update", async () => {
    render(<SupportChatWorkspace />);
    await userEvent.click(await screen.findByRole("button", { name: "Open conversation with Leena Rao" }));
    await userEvent.click(await screen.findByRole("button", { name: /Close/ }));
    expect(await screen.findByText(/new learner message will reopen/)).toBeDefined();
    await act(async () => socket.emit?.({
      v: 1,
      type: "conversation.updated",
      conversation: { id: conversation.id, status: "OPEN" },
    }));
    expect(await screen.findByLabelText("Reply to learner")).toBeDefined();
  });
});
