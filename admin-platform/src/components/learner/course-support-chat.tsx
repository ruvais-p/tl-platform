"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, RefreshCcw, Send } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SupportApiError, supportChatApi } from "@/lib/support-chat/api";
import { mergeSupportMessages } from "@/lib/support-chat/reducer";
import { SupportSocketClient } from "@/lib/support-chat/socket-client";
import type { SupportConnectionState, SupportConversation, SupportMessage, SupportServerEvent } from "@/lib/support-chat/types";
import { cn } from "@/lib/utils";

type PendingMessage = {
  clientId: string;
  requestId: string;
  content: string;
  status: "sending" | "failed";
};

const connectionCopy: Record<SupportConnectionState, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  live: "Live",
  recovering: "Reconnecting…",
  offline: "Offline",
};

function uniqueId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function senderName(message: SupportMessage) {
  if (message.sender_role === "STUDENT") return "You";
  return `${message.sender.first_name} ${message.sender.last_name}`.trim() || "Course staff";
}

export function CourseSupportChat({ courseId }: { courseId: string }) {
  const [available, setAvailable] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [connection, setConnection] = useState<SupportConnectionState>("idle");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const socketRef = useRef<SupportSocketClient | null>(null);
  const messagesRef = useRef<SupportMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const replaceMessages = useCallback((next: SupportMessage[] | ((current: SupportMessage[]) => SupportMessage[])) => {
    setMessages((current) => {
      const value = typeof next === "function" ? next(current) : next;
      messagesRef.current = value;
      return value;
    });
  }, []);

  useEffect(() => {
    let active = true;
    setAvailable(false);
    setConversation(null);
    replaceMessages([]);
    setPending([]);
    setError("");
    supportChatApi.availability(courseId)
      .then((result) => {
        if (!active) return;
        setAvailable(result.available);
        setConversation(result.conversation);
      })
      .catch(() => active && setError("Teacher support is temporarily unavailable."));
    return () => { active = false; };
  }, [courseId, replaceMessages]);

  const recover = useCallback(async (id: string, afterSequence: number) => {
    let cursor = afterSequence;
    let hasMore = true;
    let recovered: SupportMessage[] = [];
    while (hasMore) {
      const page = await supportChatApi.messages("learner", id, cursor);
      recovered = mergeSupportMessages(recovered, page.results);
      cursor = page.next_after_sequence;
      hasMore = page.has_more;
    }
    replaceMessages((current) => mergeSupportMessages(current, recovered));
    const recoveredIds = new Set(recovered.map((message) => message.client_message_id));
    setPending((current) => current.filter((item) => !recoveredIds.has(item.clientId)));
    if (cursor > 0) {
      await supportChatApi.markRead("learner", id, cursor);
      setConversation((current) => current?.id === id ? { ...current, unread_count: 0 } : current);
    }
  }, [replaceMessages]);

  const handleEvent = useCallback((event: SupportServerEvent) => {
    if (event.type === "message.created" || event.type === "message.accepted") {
      if (event.message.conversation !== conversation?.id) return;
      replaceMessages((current) => mergeSupportMessages(current, [event.message]));
      setPending((current) => current.filter((item) => item.clientId !== event.message.client_message_id));
      if (event.type === "message.created") {
        setConversation((current) => current ? { ...current, ...event.conversation, last_message: event.message } : current);
      }
      if (open && event.message.sequence > 0) {
        socketRef.current?.send({
          v: 1,
          type: "conversation.read",
          request_id: uniqueId(),
          conversation_id: event.message.conversation,
          sequence: event.message.sequence,
        });
      }
      return;
    }
    if (event.type === "conversation.updated" || event.type === "conversation.close.accepted") {
      setConversation((current) => current?.id === event.conversation.id ? { ...current, ...event.conversation } : current);
      return;
    }
    if (event.type === "error") {
      setPending((current) => current.map((item) => item.requestId === event.request_id ? { ...item, status: "failed" } : item));
      setError(event.error.message);
    }
  }, [conversation?.id, open, replaceMessages]);

  const conversationId = conversation?.id;

  useEffect(() => {
    if (!open || !conversationId) return;
    let active = true;
    setLoading(true);
    setError("");
    recover(conversationId, 0)
      .catch((caught) => active && setError(caught instanceof SupportApiError ? caught.message : "Could not load this conversation."))
      .finally(() => active && setLoading(false));
    const socket = new SupportSocketClient(
      () => supportChatApi.ticket("learner"),
      handleEvent,
      (state) => {
        setConnection(state);
        if (state === "recovering" || state === "offline") {
          setPending((current) => current.map((item) => item.status === "sending" ? { ...item, status: "failed" } : item));
        }
      },
      () => {
        const lastSequence = messagesRef.current.at(-1)?.sequence || 0;
        void recover(conversationId, lastSequence).catch(() => setError("Connected, but missed messages could not be recovered."));
      },
    );
    socketRef.current = socket;
    socket.connect();
    return () => {
      active = false;
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [conversationId, handleEvent, open, recover]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open, pending]);

  async function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || conversation || !available) return;
    setLoading(true);
    setError("");
    try {
      setConversation(await supportChatApi.openConversation(courseId));
    } catch (caught) {
      setError(caught instanceof SupportApiError ? caught.message : "Could not start teacher support.");
    } finally {
      setLoading(false);
    }
  }

  function transmit(item: PendingMessage) {
    setError("");
    setPending((current) => current.map((row) => row.clientId === item.clientId ? { ...row, status: "sending" } : row));
    const sent = socketRef.current?.send({
      v: 1,
      type: "message.send",
      request_id: item.requestId,
      conversation_id: conversation!.id,
      client_message_id: item.clientId,
      content: item.content,
    });
    if (!sent) {
      setPending((current) => current.map((row) => row.clientId === item.clientId ? { ...row, status: "failed" } : row));
      setError("Message was not sent. Reconnect and retry.");
    }
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !conversation?.can_send) return;
    const clientId = uniqueId();
    const item: PendingMessage = { clientId, requestId: uniqueId(), content, status: "sending" };
    setPending((current) => [...current, item]);
    setDraft("");
    transmit(item);
  }

  if (!available && !conversation) return null;

  const canSend = Boolean(conversation?.can_send);
  return (
    <Sheet open={open} onOpenChange={(next) => void changeOpen(next)}>
      <SheetTrigger render={<Button className="fixed bottom-36 right-4 z-40 h-11 rounded-full px-4 shadow-lg md:bottom-20 md:right-6" aria-label="Open teacher support" />}>
        <MessageCircleQuestion data-icon="inline-start" />Ask a teacher
        {conversation?.unread_count ? <span className="ml-1 grid size-5 place-items-center rounded-full bg-background text-xs font-semibold text-foreground" aria-label={`${conversation.unread_count} unread messages`}>{conversation.unread_count}</span> : null}
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b pr-12">
          <div className="flex items-center gap-2">
            <SheetTitle>Teacher support</SheetTitle>
            <Badge variant={connection === "live" ? "secondary" : "outline"}>{connectionCopy[connection]}</Badge>
          </div>
          <SheetDescription>
            Messages are shared with the staff responsible for this course.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-label="Teacher support conversation" aria-busy={loading}>
            {loading && messages.length === 0 ? <p className="my-auto text-center text-sm text-muted-foreground" role="status">Loading conversation…</p> : null}
            {!loading && messages.length === 0 ? (
              <div className="my-auto border-l-2 border-primary/50 pl-4 text-sm leading-6 text-muted-foreground">
                Ask about course material, deadlines, or anything blocking your progress. Your conversation is saved here.
              </div>
            ) : null}
            {messages.map((message) => {
              const own = message.sender_role === "STUDENT";
              return (
                <article key={message.id} aria-label={`${senderName(message)} message`} className={cn("max-w-[88%]", own && "ml-auto text-right")}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{senderName(message)}</p>
                  <p className={cn("whitespace-pre-wrap break-words rounded-xl px-3 py-2.5 text-left text-sm leading-6", own ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>{message.content}</p>
                </article>
              );
            })}
            {pending.map((item) => (
              <article key={item.clientId} className="ml-auto max-w-[88%] text-right" aria-label="Your pending message">
                <p className="rounded-xl border border-dashed bg-primary/5 px-3 py-2.5 text-left text-sm leading-6">{item.content}</p>
                <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                  <span>{item.status === "sending" ? "Sending…" : "Not sent"}</span>
                  {item.status === "failed" ? <Button type="button" variant="ghost" size="sm" onClick={() => transmit(item)}><RefreshCcw data-icon="inline-start" />Retry</Button> : null}
                </div>
              </article>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t p-4">
            {error ? <Alert variant="destructive" className="mb-3" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
            {canSend ? (
              <form onSubmit={send} className="flex items-end gap-2">
                <Textarea aria-label="Message your teacher" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder="Write a message…" disabled={!conversation} />
                <Button type="submit" size="icon-lg" aria-label="Send to teacher" disabled={!conversation || !draft.trim()}><Send /></Button>
              </form>
            ) : (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">This course is no longer active for you. You can still read the saved conversation.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {pending.some((item) => item.status === "failed") ? "A message needs to be retried." : connectionCopy[connection]}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
