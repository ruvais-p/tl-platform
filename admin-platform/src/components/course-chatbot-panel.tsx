"use client";

import { useEffect, useState } from "react";
import { Bot, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, curriculumApi } from "@/lib/curriculum/api";
import type { CourseChatbotConfig, CourseVersion } from "@/lib/curriculum/types";

const CONTEXT_LIMIT = 24_000;

export function CourseChatbotPanel({ version, canManage }: { version: CourseVersion; canManage: boolean }) {
  const [record, setRecord] = useState<CourseChatbotConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    curriculumApi.chatbotConfig(version.id)
      .then((next) => {
        if (!active) return;
        setRecord(next);
        setEnabled(next?.is_enabled ?? false);
        setContext(next?.approved_context ?? "");
      })
      .catch((caught) => active && setError(caught instanceof ApiError ? caught.message : "Could not load chatbot settings."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canManage, version.id]);

  if (!canManage) return null;

  async function save() {
    const approvedContext = context.trim();
    if (enabled && !approvedContext) {
      setError("Approved context is required before enabling the chatbot.");
      return;
    }
    if (approvedContext.length > CONTEXT_LIMIT) {
      setError(`Approved context cannot exceed ${CONTEXT_LIMIT.toLocaleString()} characters.`);
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const next = await curriculumApi.saveChatbotConfig(version.id, record, {
        is_enabled: enabled,
        approved_context: approvedContext,
      });
      setRecord(next);
      setContext(next.approved_context);
      setEnabled(next.is_enabled);
      setNotice(next.is_enabled ? "Course chatbot enabled with the approved context." : "Chatbot context saved as disabled.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save chatbot settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto mt-8 flex max-w-3xl flex-col gap-5 rounded-xl border bg-card p-5" aria-labelledby="course-chatbot-heading">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground" aria-hidden="true"><Bot className="size-4" /></span>
        <div>
          <h2 id="course-chatbot-heading" className="font-semibold">Course chatbot</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">The tutor can answer only from this version&apos;s approved context. Changing it starts a new conversation revision.</p>
        </div>
      </div>
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert role="status"><AlertDescription>{notice}</AlertDescription></Alert>}
      {loading ? <p className="text-sm text-muted-foreground" role="status">Loading chatbot settings…</p> : <>
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Enable for learners enrolled in this version
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4"><Label htmlFor={`chatbot-context-${version.id}`}>Approved context</Label><span className="text-xs tabular-nums text-muted-foreground">{context.length.toLocaleString()} / {CONTEXT_LIMIT.toLocaleString()}</span></div>
          <Textarea id={`chatbot-context-${version.id}`} value={context} onChange={(event) => setContext(event.target.value)} rows={12} maxLength={CONTEXT_LIMIT + 1} placeholder="Paste only the material that the tutor is allowed to use…" />
        </div>
        {record && <p className="text-xs text-muted-foreground">Context revision {record.context_revision} · Last saved {new Date(record.updated_at).toLocaleString()}</p>}
        <div className="flex justify-end"><Button type="button" onClick={() => void save()} disabled={saving}><Save data-icon="inline-start" />{saving ? "Saving…" : "Save chatbot settings"}</Button></div>
      </>}
    </section>
  );
}
