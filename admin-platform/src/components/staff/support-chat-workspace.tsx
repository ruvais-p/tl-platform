"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquare, RefreshCcw, Search, Send, XCircle } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { SupportApiError, supportChatApi } from "@/lib/support-chat/api";
import { mergeSupportMessages } from "@/lib/support-chat/reducer";
import { SupportSocketClient } from "@/lib/support-chat/socket-client";
import type { SupportConnectionState, SupportConversation, SupportMessage, SupportServerEvent } from "@/lib/support-chat/types";
import { cn } from "@/lib/utils";

type PendingMessage = {
  conversationId: string;
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

function displayName(person: SupportMessage["sender"] | SupportConversation["student"]) {
  return `${person.first_name} ${person.last_name}`.trim() || person.email;
}

function formatTime(value: string | null) {
  if (!value) return "No messages yet";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function SupportChatWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, SupportMessage[]>>({});
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [course, setCourse] = useState("ALL");
  const [group, setGroup] = useState("ALL");
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState<SupportConnectionState>("idle");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [nextQuery, setNextQuery] = useState<string | null>(null);
  const [error, setError] = useState("");
  const socketRef = useRef<SupportSocketClient | null>(null);
  const selectedRef = useRef<string | null>(null);
  const messagesRef = useRef<Record<string, SupportMessage[]>>({});
  const seenMessageIds = useRef(new Set<string>());
  const endRef = useRef<HTMLDivElement>(null);
  const canView = Boolean(user?.permissions.some((permission) => [
    "tutoring.reply_to_assigned_course_support_chats",
    "tutoring.view_all_course_support_chats",
  ].includes(permission)));

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  const replaceThread = useCallback((id: string, incoming: SupportMessage[]) => {
    incoming.forEach((message) => seenMessageIds.current.add(message.id));
    setMessages((current) => {
      const next = { ...current, [id]: mergeSupportMessages(current[id] || [], incoming) };
      messagesRef.current = next;
      return next;
    });
  }, []);

  const loadConversations = useCallback(async () => {
    const page = await supportChatApi.conversations();
    setConversations(page.results);
    setNextQuery(page.next ? new URL(page.next).searchParams.toString() : null);
    setSelectedId((current) => current && page.results.some((item) => item.id === current) ? current : null);
  }, []);

  async function loadMore() {
    if (!nextQuery) return;
    try {
      const page = await supportChatApi.conversations(nextQuery);
      setConversations((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        page.results.forEach((item) => byId.set(item.id, item));
        return [...byId.values()];
      });
      setNextQuery(page.next ? new URL(page.next).searchParams.toString() : null);
    } catch (caught) {
      setError(caught instanceof SupportApiError ? caught.message : "Could not load more conversations.");
    }
  }

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    loadConversations()
      .catch((caught) => active && setError(caught instanceof SupportApiError ? caught.message : "Could not load support conversations."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canView, loadConversations]);

  const recover = useCallback(async (conversationId: string, afterSequence: number) => {
    let cursor = afterSequence;
    let hasMore = true;
    let recovered: SupportMessage[] = [];
    while (hasMore) {
      const page = await supportChatApi.messages("staff", conversationId, cursor);
      recovered = mergeSupportMessages(recovered, page.results);
      cursor = page.next_after_sequence;
      hasMore = page.has_more;
    }
    replaceThread(conversationId, recovered);
    const recoveredClientIds = new Set(recovered.map((message) => message.client_message_id));
    setPending((current) => current.filter((item) => !recoveredClientIds.has(item.clientId)));
    if (cursor > 0) await supportChatApi.markRead("staff", conversationId, cursor);
    setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unread_count: 0 } : item));
  }, [replaceThread]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setThreadLoading(true);
    setError("");
    recover(selectedId, 0)
      .catch((caught) => active && setError(caught instanceof SupportApiError ? caught.message : "Could not load this conversation."))
      .finally(() => active && setThreadLoading(false));
    return () => { active = false; };
  }, [recover, selectedId]);

  const handleEvent = useCallback((event: SupportServerEvent) => {
    if (event.type === "message.created" || event.type === "message.accepted") {
      const message = event.message;
      const isNew = !seenMessageIds.current.has(message.id);
      replaceThread(message.conversation, [message]);
      setPending((current) => current.filter((item) => item.clientId !== message.client_message_id));
      setConversations((current) => {
        const next = current.map((item) => item.id === message.conversation ? {
          ...item,
          ...(event.type === "message.created" ? event.conversation : {}),
          last_message: message,
          last_sequence: Math.max(item.last_sequence, message.sequence),
          unread_count: selectedRef.current === item.id || message.sender.id === user?.id
            ? 0
            : item.unread_count + (isNew ? 1 : 0),
        } : item);
        return next.sort((left, right) => (right.last_message_at || "").localeCompare(left.last_message_at || ""));
      });
      if (selectedRef.current === message.conversation) {
        socketRef.current?.send({ v: 1, type: "conversation.read", request_id: uniqueId(), conversation_id: message.conversation, sequence: message.sequence });
      }
      if (event.type === "message.created") void loadConversations();
      return;
    }
    if (event.type === "conversation.updated" || event.type === "conversation.close.accepted") {
      setConversations((current) => current.map((item) => item.id === event.conversation.id ? { ...item, ...event.conversation } : item));
      return;
    }
    if (event.type === "conversation.read.updated" || event.type === "conversation.read.accepted") {
      setConversations((current) => current.map((item) => item.id === event.conversation_id ? { ...item, unread_count: 0 } : item));
      return;
    }
    if (event.type === "error") {
      setPending((current) => current.map((item) => item.requestId === event.request_id ? { ...item, status: "failed" } : item));
      setError(event.error.message);
    }
  }, [loadConversations, replaceThread, user?.id]);

  useEffect(() => {
    if (!canView) return;
    const socket = new SupportSocketClient(
      () => supportChatApi.ticket("staff"),
      handleEvent,
      (next) => {
        setConnection(next);
        if (next === "recovering" || next === "offline") {
          setPending((current) => current.map((item) => item.status === "sending" ? { ...item, status: "failed" } : item));
        }
      },
      () => {
        void loadConversations();
        const id = selectedRef.current;
        if (id) void recover(id, messagesRef.current[id]?.at(-1)?.sequence || 0);
      },
    );
    socketRef.current = socket;
    socket.connect();
    return () => { socket.disconnect(); if (socketRef.current === socket) socketRef.current = null; };
  }, [canView, handleEvent, loadConversations, recover]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages, pending, selectedId]);

  const courses = useMemo(() => [...new Map(conversations.map((item) => [item.course.id, item.course])).values()], [conversations]);
  const groups = useMemo(() => [...new Map(conversations.flatMap((item) => item.groups).map((item) => [item.id, item])).values()], [conversations]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return conversations.filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      if (course !== "ALL" && item.course.id !== course) return false;
      if (group !== "ALL" && !item.groups.some((itemGroup) => itemGroup.id === group)) return false;
      if (!normalized) return true;
      return [displayName(item.student), item.student.email, item.course.name, item.course.code, ...item.groups.map((itemGroup) => itemGroup.name)]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [conversations, course, group, query, status]);
  const selected = conversations.find((item) => item.id === selectedId) || null;
  const selectedMessages = selected ? messages[selected.id] || [] : [];
  const selectedPending = selected ? pending.filter((item) => item.conversationId === selected.id) : [];

  function transmit(item: PendingMessage) {
    setError("");
    setPending((current) => current.map((row) => row.clientId === item.clientId ? { ...row, status: "sending" } : row));
    const sent = socketRef.current?.send({
      v: 1,
      type: "message.send",
      request_id: item.requestId,
      conversation_id: item.conversationId,
      client_message_id: item.clientId,
      content: item.content,
    });
    if (!sent) {
      setPending((current) => current.map((row) => row.clientId === item.clientId ? { ...row, status: "failed" } : row));
      setError("Reply was not sent. Reconnect and retry.");
    }
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!selected || selected.status === "CLOSED" || !selected.can_send || !content) return;
    const item: PendingMessage = { conversationId: selected.id, clientId: uniqueId(), requestId: uniqueId(), content, status: "sending" };
    setPending((current) => [...current, item]);
    setDraft("");
    transmit(item);
  }

  async function closeConversation() {
    if (!selected) return;
    try {
      const updated = await supportChatApi.close(selected.id);
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(caught instanceof SupportApiError ? caught.message : "Could not close the conversation.");
    }
  }

  if (authLoading || loading) return <main className="grid min-h-[calc(100vh-4rem)] place-items-center" role="status"><Spinner /><span className="sr-only">Loading chats</span></main>;
  if (!canView) return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="font-heading text-2xl font-semibold">Chats</h1>
      <Alert variant="destructive" className="mt-6"><AlertDescription>You do not have permission to view course-support chats.</AlertDescription></Alert>
    </main>
  );

  return (
    <main className="flex h-[calc(100vh-4rem)] min-h-[36rem] flex-col overflow-hidden">
      <header className="flex items-center gap-4 border-b bg-background px-4 py-3 md:px-6">
        <div>
          <h1 className="font-heading text-xl font-semibold">Course support</h1>
          <p className="text-sm text-muted-foreground">Learner questions routed by current teaching responsibility.</p>
        </div>
        <Badge className="ml-auto" variant={connection === "live" ? "secondary" : "outline"}>{connectionCopy[connection]}</Badge>
      </header>
      {error ? <Alert variant="destructive" className="m-4 mb-0 md:mx-6" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="flex min-h-0 flex-1">
        <section className={cn("w-full shrink-0 flex-col border-r bg-background md:flex md:w-[23rem]", selectedId ? "hidden" : "flex")} aria-label="Support inbox">
          <div className="space-y-3 border-b p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-8" placeholder="Search learner or course" aria-label="Search chats" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs"><option value="ALL">All status</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select>
              <select aria-label="Filter by course" value={course} onChange={(event) => setCourse(event.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs"><option value="ALL">All courses</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select>
              <select aria-label="Filter by group" value={group} onChange={(event) => setGroup(event.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs"><option value="ALL">All groups</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No conversations match these filters.</p> : null}
            {filtered.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={cn("w-full border-b p-4 text-left transition-colors hover:bg-muted/60", selectedId === item.id && "bg-muted")} aria-pressed={selectedId === item.id} aria-label={`Open conversation with ${displayName(item.student)}`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{displayName(item.student).slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{displayName(item.student)}</span>{item.unread_count ? <Badge className="ml-auto">{item.unread_count}</Badge> : null}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.course.code} · {item.groups[0]?.name || "Individual enrollment"}</span>
                    <span className="mt-2 block truncate text-sm text-muted-foreground">{item.last_message?.content || "No messages yet"}</span>
                    <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{formatTime(item.last_message_at)}</span><span>{item.status === "CLOSED" ? "Closed" : "Open"}</span></span>
                  </span>
                </div>
              </button>
            ))}
            {nextQuery ? <div className="p-4"><Button type="button" variant="outline" className="w-full" onClick={() => void loadMore()}>Load more conversations</Button></div> : null}
          </div>
        </section>

        <section className={cn("min-w-0 flex-1 flex-col bg-background", selectedId ? "flex" : "hidden md:flex")} aria-label="Selected support conversation">
          {!selected ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-muted-foreground"><div><MessageSquare className="mx-auto mb-3 size-8" /><p>Select a conversation to read and reply.</p></div></div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedId(null)} aria-label="Back to inbox"><ArrowLeft /></Button>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{displayName(selected.student)}</h2>
                  <p className="truncate text-xs text-muted-foreground">{selected.course.name} · {selected.course_version.name} · {selected.groups.map((item) => item.name).join(", ") || "Individual enrollment"}</p>
                </div>
                <Badge className="ml-auto" variant={selected.status === "CLOSED" ? "outline" : "secondary"}>{selected.status === "CLOSED" ? "Closed" : "Open"}</Badge>
                {selected.can_close && selected.status === "OPEN" ? <Button variant="outline" size="sm" onClick={() => void closeConversation()}><XCircle data-icon="inline-start" />Close</Button> : null}
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:px-8" aria-live="polite" aria-busy={threadLoading}>
                {threadLoading && selectedMessages.length === 0 ? <p className="my-auto text-center text-sm text-muted-foreground" role="status">Loading conversation…</p> : null}
                {!threadLoading && selectedMessages.length === 0 ? <p className="my-auto text-center text-sm text-muted-foreground">No messages yet.</p> : null}
                {selectedMessages.map((message) => {
                  const own = message.sender.id === user?.id;
                  return <article key={message.id} className={cn("max-w-[80%]", own && "ml-auto")} aria-label={`${own ? "Your" : displayName(message.sender)} message`}><p className={cn("mb-1 text-xs font-medium text-muted-foreground", own && "text-right")}>{own ? "You" : displayName(message.sender)}</p><p className={cn("whitespace-pre-wrap break-words rounded-xl px-3 py-2.5 text-sm leading-6", own ? "bg-primary text-primary-foreground" : "bg-muted")}>{message.content}</p></article>;
                })}
                {selectedPending.map((item) => <article key={item.clientId} className="ml-auto max-w-[80%]"><p className="rounded-xl border border-dashed bg-primary/5 px-3 py-2.5 text-sm leading-6">{item.content}</p><div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted-foreground"><span>{item.status === "sending" ? "Sending…" : "Not sent"}</span>{item.status === "failed" ? <Button type="button" variant="ghost" size="sm" onClick={() => transmit(item)}><RefreshCcw data-icon="inline-start" />Retry</Button> : null}</div></article>)}
                <div ref={endRef} />
              </div>
              <footer className="border-t p-4 md:px-8">
                {selected.status === "CLOSED" ? <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground"><CheckCircle2 className="size-4" />This conversation is closed. A new learner message will reopen it.</p> : (
                  <form onSubmit={send} className="flex items-end gap-2"><Textarea aria-label="Reply to learner" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder="Write a reply…" /><Button type="submit" size="icon-lg" aria-label="Send reply" disabled={!selected.can_send || !draft.trim()}><Send /></Button></form>
                )}
                <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{pending.some((item) => item.status === "failed" && item.conversationId === selected.id) ? "A reply needs to be retried." : connectionCopy[connection]}</p>
              </footer>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
