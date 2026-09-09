"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { LearnerApiError, learnerApi } from "@/lib/learner/api";
import type { ChatCitation } from "@/lib/learner/types";
import { cn } from "@/lib/utils";

type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
};

export function CourseChatbot({ courseId }: { courseId: string }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messageSequence = useRef(0);

  useEffect(() => {
    let active = true;
    setAvailable(false);
    setMessages([]);
    setSessionId(null);
    setError("");
    learnerApi.course(courseId)
      .then((course) => active && setAvailable(Boolean(course.chatbot_available)))
      .catch(() => active && setAvailable(false));
    return () => { active = false; };
  }, [courseId]);

  useEffect(() => {
    if (open) messageEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open, pending]);

  if (!available) return null;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending) return;
    const userMessage: DisplayMessage = { id: `${courseId}-${++messageSequence.current}`, role: "user", content: message };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setPending(true);
    setError("");
    try {
      const response = await learnerApi.sendCourseChat(courseId, message, sessionId);
      setSessionId(response.session_id);
      setMessages((current) => [...current, {
        id: `${courseId}-${++messageSequence.current}`,
        role: "assistant",
        content: response.reply,
        citations: response.citations,
      }]);
    } catch (caught) {
      if (caught instanceof LearnerApiError && caught.status === 404) setAvailable(false);
      setError(caught instanceof LearnerApiError ? caught.message : "Tutor temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="fixed bottom-20 right-4 z-40 h-11 rounded-full px-4 shadow-lg md:bottom-6 md:right-6" aria-label="Open course chatbot" />}>
        <Bot data-icon="inline-start" />Ask course tutor
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Course tutor</SheetTitle>
          <SheetDescription>Answers are limited to context approved for this course version.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-label="Course tutor conversation">
            {messages.length === 0 && (
              <div className="my-auto rounded-xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                Ask about material in this course. If the approved context does not contain the answer, I will say so.
              </div>
            )}
            {messages.map((message) => (
              <article key={message.id} aria-label={`${message.role === "user" ? "Your" : "Course tutor"} message`} className={cn("max-w-[88%] rounded-xl px-3 py-2.5 text-sm", message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
                {message.citations?.length ? (
                  <details className="mt-2 border-t border-current/15 pt-2 text-xs">
                    <summary className="cursor-pointer font-medium">Supporting course context</summary>
                    <ul className="mt-2 space-y-2">
                      {message.citations.map((citation, index) => <li key={`${citation.chunk_id}-${index}`}><span className="font-semibold">{citation.chunk_id}</span>: “{citation.excerpt}”</li>)}
                    </ul>
                  </details>
                ) : null}
              </article>
            ))}
            {pending && <p className="text-sm text-muted-foreground" role="status">Course tutor is checking the approved context…</p>}
            <div ref={messageEndRef} />
          </div>
          <div className="border-t p-4">
            {error && <Alert variant="destructive" className="mb-3" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
            <form onSubmit={send} className="flex items-end gap-2">
              <Textarea aria-label="Message course tutor" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={2} placeholder="Ask about this course…" disabled={pending} />
              <Button type="submit" size="icon-lg" aria-label="Send message" disabled={pending || !draft.trim()}><Send /></Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{pending ? "Sending message." : error ? error : messages.length ? "Response received." : "Ready for a course question."}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
