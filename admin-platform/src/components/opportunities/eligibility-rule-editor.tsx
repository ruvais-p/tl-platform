"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EligibilityCondition, EligibilityRules } from "@/lib/opportunities/types";

export type RuleRelations = {
  groups: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string }>;
  learningChecks: Array<{ id: string; title: string }>;
};

const factLabels: Record<EligibilityCondition["fact"], string> = {
  STUDENT_GROUP: "Student group membership",
  GROUP_GRADE: "Group grade",
  COURSE_ENROLLMENT: "Course enrollment status",
  COURSE_COMPLETION: "Course completion",
  COURSE_PROGRESS: "Minimum course progress",
  LEARNING_CHECK_SCORE: "Minimum learning-check score",
};

function emptyCondition(fact: EligibilityCondition["fact"], relations: RuleRelations): EligibilityCondition {
  if (fact === "STUDENT_GROUP") return { fact, operator: "IN", values: relations.groups[0]?.id ? [relations.groups[0].id] : [] };
  if (fact === "GROUP_GRADE") return { fact, operator: "IN", values: [""] };
  if (fact === "COURSE_ENROLLMENT") return { fact, operator: "IN", course_id: relations.courses[0]?.id ?? "", values: ["ACTIVE"] };
  if (fact === "COURSE_COMPLETION") return { fact, operator: "EQ", course_id: relations.courses[0]?.id ?? "", value: true };
  if (fact === "COURSE_PROGRESS") return { fact, operator: "GTE", course_id: relations.courses[0]?.id ?? "", value: 80 };
  return { fact, operator: "GTE", learning_check_id: relations.learningChecks[0]?.id ?? "", value: 70 };
}

export function EligibilityRuleEditor({ value, onChange, relations, error }: { value: EligibilityRules; onChange: (value: EligibilityRules) => void; relations: RuleRelations; error?: string }) {
  const update = (index: number, condition: EligibilityCondition) => onChange({ ...value, conditions: value.conditions.map((item, itemIndex) => itemIndex === index ? condition : item) });
  const move = (index: number, offset: number) => {
    const next = [...value.conditions];
    const [condition] = next.splice(index, 1);
    next.splice(index + offset, 0, condition);
    onChange({ ...value, conditions: next });
  };

  return (
    <section aria-labelledby="eligibility-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="eligibility-heading" className="text-lg font-semibold">Eligibility</h2><p className="text-sm text-muted-foreground">Match learner facts using one understandable rule group.</p></div><label className="text-sm font-medium">Match <select aria-label="Rule match" className="ml-2 h-9 rounded-md border bg-background px-3" value={value.match} onChange={(event) => onChange({ ...value, match: event.target.value as "ALL" | "ANY" })}><option value="ALL">all conditions</option><option value="ANY">any condition</option></select></label></div>
      <div className="divide-y rounded-xl border">
        {value.conditions.map((condition, index) => <div key={`${condition.fact}-${index}`} className="grid gap-3 p-4 lg:grid-cols-[minmax(13rem,1fr)_minmax(15rem,2fr)_auto] lg:items-end">
          <label className="text-sm font-medium">Fact<select aria-label={`Condition ${index + 1} fact`} className="mt-1 block h-9 w-full rounded-md border bg-background px-3" value={condition.fact} onChange={(event) => update(index, emptyCondition(event.target.value as EligibilityCondition["fact"], relations))}>{Object.entries(factLabels).map(([fact, label]) => <option value={fact} key={fact}>{label}</option>)}</select></label>
          <ConditionControl condition={condition} index={index} relations={relations} onChange={(next) => update(index, next)} />
          <div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Move condition ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Move condition ${index + 1} down`} disabled={index === value.conditions.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Remove condition ${index + 1}`} onClick={() => onChange({ ...value, conditions: value.conditions.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></div>
        </div>)}
        {value.conditions.length === 0 && <p className="p-5 text-sm text-muted-foreground">No conditions. Every learner in the audience is eligible.</p>}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="button" variant="outline" onClick={() => onChange({ ...value, conditions: [...value.conditions, emptyCondition("STUDENT_GROUP", relations)] })}><Plus data-icon="inline-start" />Add condition</Button>
    </section>
  );
}

function ConditionControl({ condition, index, relations, onChange }: { condition: EligibilityCondition; index: number; relations: RuleRelations; onChange: (value: EligibilityCondition) => void }) {
  const label = `Condition ${index + 1} value`;
  if (condition.fact === "STUDENT_GROUP") return <label className="text-sm font-medium">Student group<select aria-label={label} className="mt-1 block h-9 w-full rounded-md border bg-background px-3" value={condition.values[0] ?? ""} onChange={(event) => onChange({ ...condition, values: [event.target.value] })}><option value="">Select group</option>{relations.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>;
  if (condition.fact === "GROUP_GRADE") return <label className="text-sm font-medium">Grade<Input aria-label={label} className="mt-1" value={condition.values.join(", ")} onChange={(event) => onChange({ ...condition, values: event.target.value.split(",").map((item) => item.trim()) })} /></label>;
  if (condition.fact === "LEARNING_CHECK_SCORE") return <div className="grid gap-2 sm:grid-cols-[1fr_8rem]"><label className="text-sm font-medium">Learning check<select aria-label={`${label} reference`} className="mt-1 block h-9 w-full rounded-md border bg-background px-3" value={condition.learning_check_id} onChange={(event) => onChange({ ...condition, learning_check_id: event.target.value })}><option value="">Select check</option>{relations.learningChecks.map((check) => <option key={check.id} value={check.id}>{check.title}</option>)}</select></label><label className="text-sm font-medium">Minimum %<Input aria-label={label} type="number" min={0} max={100} className="mt-1" value={condition.value} onChange={(event) => onChange({ ...condition, value: Number(event.target.value) })} /></label></div>;
  return <div className="grid gap-2 sm:grid-cols-[1fr_10rem]"><label className="text-sm font-medium">Course<select aria-label={`${label} reference`} className="mt-1 block h-9 w-full rounded-md border bg-background px-3" value={condition.course_id} onChange={(event) => onChange({ ...condition, course_id: event.target.value })}><option value="">Select course</option>{relations.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>{condition.fact === "COURSE_ENROLLMENT" ? <label className="text-sm font-medium">Status<select aria-label={label} className="mt-1 block h-9 w-full rounded-md border bg-background px-3" value={condition.values[0]} onChange={(event) => onChange({ ...condition, values: [event.target.value] })}><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="SUSPENDED">Suspended</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option></select></label> : condition.fact === "COURSE_COMPLETION" ? <label className="text-sm font-medium">Required<select aria-label={label} className="mt-1 block h-9 w-full rounded-md border bg-background px-3" value={String(condition.value)} onChange={(event) => onChange({ ...condition, value: event.target.value === "true" })}><option value="true">Completed</option><option value="false">Not completed</option></select></label> : <label className="text-sm font-medium">Minimum %<Input aria-label={label} type="number" min={0} max={100} className="mt-1" value={condition.value} onChange={(event) => onChange({ ...condition, value: Number(event.target.value) })} /></label>}</div>;
}
