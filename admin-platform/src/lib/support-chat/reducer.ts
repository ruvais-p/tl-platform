import type { SupportConversation, SupportMessage, SupportServerEvent } from "./types";

export type SupportChatState = {
  conversations: SupportConversation[];
  messages: Record<string, SupportMessage[]>;
  readSequences: Record<string, number>;
};

export const emptySupportChatState: SupportChatState = { conversations: [], messages: {}, readSequences: {} };

export function mergeSupportMessages(current: SupportMessage[], incoming: SupportMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

export function reduceSupportEvent(state: SupportChatState, event: SupportServerEvent): SupportChatState {
  if (event.type === "message.created" || event.type === "message.accepted") {
    const id = event.message.conversation;
    return {
      ...state,
      messages: { ...state.messages, [id]: mergeSupportMessages(state.messages[id] || [], [event.message]) },
      conversations: state.conversations.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              ...(event.type === "message.created" ? event.conversation : {}),
              last_message: event.message,
              last_sequence: Math.max(conversation.last_sequence, event.message.sequence),
            }
          : conversation,
      ),
    };
  }
  if (event.type === "conversation.updated" || event.type === "conversation.close.accepted") {
    return {
      ...state,
      conversations: state.conversations.map((conversation) =>
        conversation.id === event.conversation.id ? { ...conversation, ...event.conversation } : conversation,
      ),
    };
  }
  if (event.type === "conversation.read.updated" || event.type === "conversation.read.accepted") {
    return {
      ...state,
      readSequences: {
        ...state.readSequences,
        [event.conversation_id]: Math.max(state.readSequences[event.conversation_id] || 0, event.sequence),
      },
    };
  }
  return state;
}
