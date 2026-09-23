import type {
  SupportAvailability,
  SupportConversation,
  SupportConversationPage,
  SupportMessagePage,
  SupportPortal,
  SupportTicket,
} from "./types";

export class SupportApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(portal: SupportPortal, path: string, init?: RequestInit): Promise<T> {
  const prefix = portal === "staff" ? "/api/staff" : "/api/learner/data";
  const response = await fetch(`${prefix}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { detail?: string; error?: { message?: string } };
      message = body.error?.message || body.detail || message;
    } catch {}
    throw new SupportApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

const post = <T>(portal: SupportPortal, path: string, body: Record<string, unknown> = {}) =>
  request<T>(portal, path, { method: "POST", body: JSON.stringify(body) });

export const supportChatApi = {
  availability: (courseId: string) => request<SupportAvailability>("learner", `courses/${courseId}/support-conversation`),
  openConversation: (courseId: string) => post<SupportConversation>("learner", `courses/${courseId}/support-conversation`),
  conversations: (query = "") => request<SupportConversationPage>("staff", `course-support/conversations${query ? `?${query}` : ""}`),
  messages: (portal: SupportPortal, conversationId: string, afterSequence = 0) =>
    request<SupportMessagePage>(portal, `course-support/conversations/${conversationId}/messages?after_sequence=${afterSequence}&limit=100`),
  markRead: (portal: SupportPortal, conversationId: string, sequence: number) =>
    post<{ conversation_id: string; sequence: number }>(portal, `course-support/conversations/${conversationId}/read`, { sequence }),
  close: (conversationId: string) => post<SupportConversation>("staff", `course-support/conversations/${conversationId}/close`),
  ticket: (portal: SupportPortal) => post<SupportTicket>(portal, "course-support/socket-ticket", { portal }),
};
