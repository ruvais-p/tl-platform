"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Clock3, RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { LearnerApiError, learnerApi } from "@/lib/learner/api";
import type { AssessmentAttempt, LearningCheck, LearningCheckQuestion } from "@/lib/learner/types";
import { cn } from "@/lib/utils";
import { ErrorState, LoadingState } from "./common";

type AnswerMap = Record<string, string | string[]>;

function answered(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

function QuestionInput({ item, value, onChange, promptId }: { item: LearningCheckQuestion; value?: string | string[]; onChange: (value: string | string[]) => void; promptId: string }) {
  const question = item.question_detail;
  if (question.question_type === "MCQ" || question.question_type === "TRUE_FALSE") {
    return (
      <FieldGroup className="gap-2">
        {question.options.map((option) => {
          const selected = value === option.id;
          return (
            <label key={option.id} className={cn("learner-pressable flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-5", selected ? "border-primary/45 bg-primary/5" : "bg-background hover:bg-muted/55")}>
              <input type="radio" name={`question-${question.id}`} value={option.id} checked={selected} onChange={() => onChange(option.id)} className="mt-0.5 size-4 accent-primary" />
              <span>{option.option_text}</span>
            </label>
          );
        })}
      </FieldGroup>
    );
  }
  if (question.question_type === "MULTI_SELECT") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <FieldGroup className="gap-2">
        {question.options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label key={option.id} className={cn("learner-pressable flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-5", checked ? "border-primary/45 bg-primary/5" : "bg-background hover:bg-muted/55")}>
              <input type="checkbox" value={option.id} checked={checked} onChange={() => onChange(checked ? selected.filter((id) => id !== option.id) : [...selected, option.id])} className="mt-0.5 size-4 rounded accent-primary" />
              <span>{option.option_text}</span>
            </label>
          );
        })}
      </FieldGroup>
    );
  }
  if (question.question_type === "LONG_TEXT") return <Textarea value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} rows={6} placeholder="Write your answer" aria-labelledby={promptId} />;
  return <Input type={question.question_type === "NUMERIC" ? "number" : "text"} inputMode={question.question_type === "NUMERIC" ? "decimal" : undefined} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} placeholder={question.question_type === "MATH_EXPRESSION" ? "Enter your mathematical expression" : "Enter your answer"} aria-labelledby={promptId} className="h-10" />;
}

export function LearningCheckView({ courseId, checkId }: { courseId: string; checkId: string }) {
  const [check, setCheck] = useState<LearningCheck | null>(null);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [result, setResult] = useState<AssessmentAttempt | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const [checkRow, resultRows] = await Promise.all([learnerApi.learningCheck(checkId), learnerApi.checkResults(checkId).catch(() => [])]);
      setCheck(checkRow);
      setAttempts(resultRows);
      const open = [...resultRows].reverse().find((row) => row.status === "STARTED") ?? null;
      if (open) { setAttempt(open); startedAt.current = new Date(open.started_at).getTime(); }
    } catch (caught) { setError(caught instanceof LearnerApiError ? caught.message : "This learning check could not be loaded."); }
  }, [checkId]);

  useEffect(() => { void load(); }, [load]);
  const orderedQuestions = useMemo(() => [...(check?.questions || [])].sort((a, b) => a.display_order - b.display_order), [check]);

  async function start() {
    setBusy(true); setFormError(""); setResult(null); setAnswers({});
    try {
      const row = await learnerApi.startCheck(checkId);
      setAttempt(row); setAttempts((current) => [...current, row]); startedAt.current = Date.now();
    } catch (caught) { setFormError(caught instanceof LearnerApiError ? caught.message : "A new attempt could not be started."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!attempt || !check) return;
    const missing = orderedQuestions.find((item) => item.is_required && !answered(answers[item.question]));
    if (missing) { setFormError("Please answer every required question before submitting."); return; }
    setBusy(true); setFormError("");
    try {
      const payload = orderedQuestions.map((item) => ({ question: item.question, answer: answers[item.question] ?? "" }));
      const row = await learnerApi.submitCheck(checkId, attempt.id, payload, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)));
      setResult(row); setAttempt(null); setAttempts((current) => [...current.filter((item) => item.id !== row.id), row]);
    } catch (caught) { setFormError(caught instanceof LearnerApiError ? caught.message : "Your answers could not be submitted."); }
    finally { setBusy(false); }
  }

  if (!check && !error) return <LoadingState label="Preparing your learning check…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!check) return null;

  const usedAttempts = attempts.length;
  const remaining = Math.max(0, check.max_attempts - usedAttempts);
  const latestResult = result ?? [...attempts].reverse().find((row) => row.status === "GRADED") ?? null;

  if (!attempt) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Button asChild variant="ghost" className="self-start"><Link href={`/learn/courses/${courseId}`}><ArrowLeft data-icon="inline-start" />Back to course</Link></Button>
        <Card>
          <CardHeader>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-primary">
              <BookOpenCheck className="size-4" aria-hidden="true" />
              Learning check
            </p>
            <CardTitle className="text-3xl">{check.title}</CardTitle>
            {check.instructions && <CardDescription className="max-w-2xl leading-6">{check.instructions}</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground"><span className="tabular-nums">{orderedQuestions.length}</span> questions</span>
            <span className="text-sm text-muted-foreground"><span className="tabular-nums">{check.passing_score}%</span> to pass</span>
            {check.time_limit_minutes && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /><span className="tabular-nums">{check.time_limit_minutes}</span> minutes</span>}
          </CardContent>
        </Card>

        {latestResult && (
          <Alert className={latestResult.passed ? "text-success" : "text-warning-foreground"} aria-label="Latest result">
            {latestResult.passed ? <Trophy /> : <RotateCcw />}
            <AlertTitle>{latestResult.percentage}% · {latestResult.passed ? "Passed" : "Keep learning"}</AlertTitle>
            <AlertDescription>Attempt {latestResult.attempt_number} of {check.max_attempts}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-muted-foreground" />Before you begin</CardTitle>
            <CardDescription className="leading-6">Your answers are scored securely after submission. Review the lesson material first if you need to.</CardDescription>
          </CardHeader>
          <CardFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
            <p className="text-xs tabular-nums text-muted-foreground">{remaining} {remaining === 1 ? "attempt" : "attempts"} remaining</p>
            <Button onClick={() => void start()} disabled={busy || remaining === 0}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              {busy ? "Starting…" : latestResult && !latestResult.passed ? "Try again" : "Start learning check"}
              {!busy ? <ArrowRight data-icon="inline-end" /> : null}
            </Button>
          </CardFooter>
        </Card>
        {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost"><Link href={`/learn/courses/${courseId}`}><ArrowLeft data-icon="inline-start" />Exit learning check</Link></Button>
        <span className="text-sm text-muted-foreground">Attempt <span className="tabular-nums">{attempt.attempt_number}</span> of <span className="tabular-nums">{check.max_attempts}</span></span>
      </div>
      <Card>
        <CardHeader>
          <p className="mb-2 text-sm font-medium text-primary">Knowledge check</p>
          <CardTitle className="text-2xl sm:text-3xl">{check.title}</CardTitle>
          <CardDescription className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1.5"><BookOpenCheck className="size-3.5" />{orderedQuestions.length} questions</span>
            {check.time_limit_minutes && <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{check.time_limit_minutes} minute guide</span>}
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {orderedQuestions.map((item, index) => {
          const promptId = `question-prompt-${item.id}`;
          return (
            <FieldSet key={item.id} className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
              <FieldLegend className="sr-only">{item.question_detail.question_text}</FieldLegend>
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold tabular-nums text-secondary-foreground">{index + 1}</span>
                <div className="flex flex-col gap-1">
                  <p id={promptId} className="text-sm font-medium leading-6 sm:text-base">{item.question_detail.question_text}</p>
                  <p className="text-xs text-muted-foreground"><span className="tabular-nums">{item.marks}</span> {Number(item.marks) === 1 ? "mark" : "marks"}{item.is_required ? " · Required" : ""}</p>
                </div>
              </div>
              <QuestionInput item={item} value={answers[item.question]} onChange={(value) => setAnswers((current) => ({ ...current, [item.question]: value }))} promptId={promptId} />
            </FieldSet>
          );
        })}
        {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
        <Card size="sm">
          <CardFooter className="flex-col gap-3 border-t-0 bg-card sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground">Review your answers before submitting.</p>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              {busy ? "Submitting…" : "Submit answers"}
              {!busy ? <CheckCircle2 data-icon="inline-end" /> : null}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
