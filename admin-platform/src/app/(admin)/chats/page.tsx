import type { Metadata } from "next";

import { SupportChatWorkspace } from "@/components/staff/support-chat-workspace";

export const metadata: Metadata = { title: "Course support chats" };

export default function ChatsPage() {
  return <SupportChatWorkspace />;
}
