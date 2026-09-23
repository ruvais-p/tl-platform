export type SupportPortal = "staff" | "learner";
export type SupportConnectionState = "idle" | "connecting" | "live" | "recovering" | "offline";

export type SupportPerson = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
};

export type SupportMessage = {
  id: string;
  conversation: string;
  sender: SupportPerson;
  sender_role: "STUDENT" | "TEACHER" | "ACADEMIC_MANAGER" | "ADMIN";
  sequence: number;
  client_message_id: string;
  content: string;
  created_at: string;
};

export type SupportConversation = {
  id: string;
  student: SupportPerson;
  course: { id: string; name: string; code: string };
  course_version: { id: string; name: string; version_number: number };
  groups: Array<{ id: string; name: string; code: string }>;
  status: "OPEN" | "CLOSED";
  last_sequence: number;
  last_message_at: string | null;
  last_message: SupportMessage | null;
  unread_count: number;
  can_send: boolean;
  can_close: boolean;
  created_at: string;
  updated_at: string;
};

export type SupportTicket = { ticket: string; expires_at: string; websocket_url: string };
export type SupportMessagePage = { results: SupportMessage[]; has_more: boolean; next_after_sequence: number };
export type SupportConversationPage = { next: string | null; previous: string | null; results: SupportConversation[] };
export type SupportAvailability = { available: boolean; conversation: SupportConversation | null };

export type SupportServerEvent =
  | { v: 1; type: "message.created"; conversation: Partial<SupportConversation> & { id: string }; message: SupportMessage }
  | { v: 1; type: "conversation.updated"; conversation: Partial<SupportConversation> & { id: string } }
  | { v: 1; type: "conversation.read.updated"; conversation_id: string; sequence: number }
  | { v: 1; type: "message.accepted"; request_id: string; created: boolean; message: SupportMessage }
  | { v: 1; type: "conversation.read.accepted"; request_id: string; conversation_id: string; sequence: number }
  | { v: 1; type: "conversation.close.accepted"; request_id: string; conversation: Partial<SupportConversation> & { id: string } }
  | { v: 1; type: "error"; request_id: string | null; error: { code: string; message: string; details: Record<string, unknown> } };

export type SupportClientCommand =
  | { v: 1; type: "message.send"; request_id: string; conversation_id: string; client_message_id: string; content: string }
  | { v: 1; type: "conversation.read"; request_id: string; conversation_id: string; sequence: number }
  | { v: 1; type: "conversation.close"; request_id: string; conversation_id: string };
