"use client";
import Link from "next/link";
import {
  Children,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError, curriculumApi } from "@/lib/curriculum/api";
import {
  findSelected,
  resourceEndpoint,
  type SelectedResource,
} from "@/lib/curriculum/tree";
import type {
  Activity,
  Chapter,
  Course,
  CourseVersion,
  ResourceKind,
  Selection,
  Status,
  Subtopic,
  UUID,
} from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth-provider";
const statuses: Status[] = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
];
const activityTypes = [
  "CONCEPT_VIDEO",
  "EXPERIMENT",
  "CONCEPT_OVERVIEW",
  "OBSERVE_LEARN_PRACTICE",
  "HOMEWORK",
  "INTERACTIVE_WORKSHOP",
  "SIMULATION",
  "READING",
  "PDF",
  "INTERACTIVE",
  "ASSIGNMENT",
  "PROJECT",
  "LIVE_CLASS",
  "FLASHCARD",
];
const experimentActivityTypes = new Set([
  "EXPERIMENT",
  "SIMULATION",
  "INTERACTIVE",
  "INTERACTIVE_WORKSHOP",
]);
const experimentTypes = [
  "HTML_INTERACTIVE",
  "EMBEDDED",
  "SIMULATION",
  "QUESTION_BASED",
];
const optionLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
const statusOptions = statuses.map((value) => ({
  label: optionLabel(value),
  value,
}));
const activityTypeOptions = activityTypes.map((value) => ({
  label: optionLabel(value),
  value,
}));
const experimentTypeOptions = experimentTypes.map((value) => ({
  label: optionLabel(value),
  value,
}));
const defaultExperimentConfiguration = {
  schema_version: 1,
  renderer: "placeholder",
  renderer_config: {},
};
type NewItem = { kind: ResourceKind; parent: UUID };
const addPermissionByKind: Record<ResourceKind, string> = {
  version: "curriculum.add_courseversion",
  chapter: "curriculum.add_chapter",
  subtopic: "curriculum.add_subtopic",
  activity: "curriculum.add_learningactivity",
};
const changePermissionByKind: Record<ResourceKind, string> = {
  version: "curriculum.change_courseversion",
  chapter: "curriculum.change_chapter",
  subtopic: "curriculum.change_subtopic",
  activity: "curriculum.change_learningactivity",
};
const label = (kind: ResourceKind) => kind[0].toUpperCase() + kind.slice(1);
function ErrorBox({ message }: { message: string }) {
  return message ? (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null;
}

export function CurriculumEditor({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [newItem, setNewItem] = useState<NewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [mobileInspector, setMobileInspector] = useState(false);
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const canAdd = (kind: ResourceKind) =>
    permissions.includes(addPermissionByKind[kind]);
  const canChange = (kind: ResourceKind) =>
    permissions.includes(changePermissionByKind[kind]);
  const load = useCallback(
    async (preferred?: Selection) => {
      setLoading(true);
      try {
        const next = await curriculumApi.course(courseId);
        setCourse(next);
        if (preferred) setSelection(preferred);
        else
          setSelection(
            (current) =>
              current ||
              (next.versions[0]
                ? { kind: "version", id: next.versions[0].id }
                : null),
          );
        setError("");
      } catch (x) {
        setError(
          x instanceof ApiError ? x.message : "Could not load the course.",
        );
      } finally {
        setLoading(false);
      }
    },
    [courseId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function choose(next: Selection) {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setDirty(false);
    setSelection(next);
    setNewItem(null);
    setMobileInspector(true);
  }
  const selected = useMemo(
    () => (course ? findSelected(course, selection) : null),
    [course, selection],
  );
  async function reorder(
    path: string,
    items: { id: UUID }[],
    index: number,
    direction: number,
  ) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((x) => x.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await curriculumApi.reorder(path, ids);
      await load();
    } catch (x) {
      setError(x instanceof ApiError ? x.message : "Could not reorder items.");
    }
  }
  if (loading && !course)
    return (
      <div
        className="grid min-h-[70vh] place-items-center text-sm text-muted-foreground"
        role="status"
      >
        Loading course structure…
      </div>
    );
  if (!course)
    return (
      <main className="p-8">
        <ErrorBox message={error} />
        <Button
          render={<Link href="/courses" />}
          nativeButton={false}
          variant="outline"
          className="mt-4"
        >
          Back to courses
        </Button>
      </main>
    );
  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <header className="flex items-center gap-4 border-b bg-background px-4 py-4 md:px-7">
        <Button
          render={<Link href="/courses" aria-label="Back to courses" />}
          nativeButton={false}
          size="icon"
          variant="ghost"
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{course.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {course.program_name} · {course.code}
          </p>
        </div>
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          {course.status}
        </span>
      </header>
      {error && (
        <div className="px-4 pt-4 md:px-7">
          <ErrorBox message={error} />
        </div>
      )}
      <div className="grid min-w-0 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section
          className={cn(
            "min-w-0 min-h-[calc(100vh-8rem)] border-r bg-background p-4 md:p-6",
            mobileInspector ? "hidden lg:block" : "block",
          )}
          aria-label="Course hierarchy"
        >
          <div className="mb-5 flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">
                Course structure
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Select an item to edit it.
              </p>
            </div>
            {canAdd("version") && (
              <Button
                variant="outline"
                onClick={() =>
                  setNewItem({ kind: "version", parent: course.id })
                }
              >
                <Plus data-icon="inline-start" />
                Version
              </Button>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            {course.versions.map((version) => (
              <TreeRow
                key={version.id}
                depth={0}
                active={selection?.id === version.id}
                title={version.name}
                meta={`v${version.version_number}`}
                onClick={() => choose({ kind: "version", id: version.id })}
                onAdd={
                  canAdd("chapter")
                    ? () => setNewItem({ kind: "chapter", parent: version.id })
                    : undefined
                }
                hideMove
              >
                {version.chapters.map((chapter, ci) => (
                  <TreeRow
                    key={chapter.id}
                    depth={1}
                    active={selection?.id === chapter.id}
                    title={chapter.title}
                    meta={`${chapter.estimated_minutes} min`}
                    onClick={() => choose({ kind: "chapter", id: chapter.id })}
                    onAdd={
                      canAdd("subtopic")
                        ? () =>
                            setNewItem({
                              kind: "subtopic",
                              parent: chapter.id,
                            })
                        : undefined
                    }
                    onUp={
                      canChange("chapter") && ci > 0
                        ? () =>
                            reorder(
                              `course-versions/${version.id}/reorder_chapters`,
                              version.chapters,
                              ci,
                              -1,
                            )
                        : undefined
                    }
                    onDown={
                      canChange("chapter") &&
                      ci < version.chapters.length - 1
                        ? () =>
                            reorder(
                              `course-versions/${version.id}/reorder_chapters`,
                              version.chapters,
                              ci,
                              1,
                            )
                        : undefined
                    }
                    canReorder={canChange("chapter")}
                  >
                    {chapter.subtopics.map((subtopic, si) => (
                      <TreeRow
                        key={subtopic.id}
                        depth={2}
                        active={selection?.id === subtopic.id}
                        title={subtopic.title}
                        meta={`${subtopic.activities.length} activities`}
                        onClick={() =>
                          choose({ kind: "subtopic", id: subtopic.id })
                        }
                        onAdd={
                          canAdd("activity")
                            ? () =>
                                setNewItem({
                                  kind: "activity",
                                  parent: subtopic.id,
                                })
                            : undefined
                        }
                        onUp={
                          canChange("subtopic") && si > 0
                            ? () =>
                                reorder(
                                  `chapters/${chapter.id}/reorder_subtopics`,
                                  chapter.subtopics,
                                  si,
                                  -1,
                                )
                            : undefined
                        }
                        onDown={
                          canChange("subtopic") &&
                          si < chapter.subtopics.length - 1
                            ? () =>
                                reorder(
                                  `chapters/${chapter.id}/reorder_subtopics`,
                                  chapter.subtopics,
                                  si,
                                  1,
                                )
                            : undefined
                        }
                        canReorder={canChange("subtopic")}
                      >
                        {subtopic.activities.map((activity, ai) => (
                          <TreeRow
                            key={activity.id}
                            depth={3}
                            active={selection?.id === activity.id}
                            title={activity.title}
                            meta={activity.activity_type.replaceAll("_", " ")}
                            onClick={() =>
                              choose({ kind: "activity", id: activity.id })
                            }
                            onUp={
                              canChange("activity") && ai > 0
                                ? () =>
                                    reorder(
                                      `subtopics/${subtopic.id}/reorder_activities`,
                                      subtopic.activities,
                                      ai,
                                      -1,
                                    )
                                : undefined
                            }
                            onDown={
                              canChange("activity") &&
                              ai < subtopic.activities.length - 1
                                ? () =>
                                    reorder(
                                      `subtopics/${subtopic.id}/reorder_activities`,
                                      subtopic.activities,
                                      ai,
                                      1,
                                    )
                                : undefined
                            }
                            canReorder={canChange("activity")}
                          />
                        ))}
                      </TreeRow>
                    ))}
                  </TreeRow>
                ))}
              </TreeRow>
            ))}
          </div>
        </section>
        <section
          className={cn(
            "min-w-0 p-4 md:p-8",
            mobileInspector ? "block" : "hidden lg:block",
          )}
        >
          <Button
            variant="ghost"
            className="mb-4 lg:hidden"
            onClick={() => setMobileInspector(false)}
          >
            <ArrowLeft />
            Structure
          </Button>
          {newItem && canAdd(newItem.kind) ? (
            <CreateForm
              item={newItem}
              course={course}
              count={countChildren(course, newItem)}
              onCancel={() => setNewItem(null)}
              onCreated={async (s) => {
                setNewItem(null);
                await load(s);
                setMobileInspector(true);
              }}
              onError={setError}
            />
          ) : selected && selection ? (
            <Inspector
              course={course}
              selection={selection}
              resource={selected}
              canPublish={Boolean(
                user?.permissions.includes("curriculum.publish_course"),
              )}
              canEdit={canChange(selection.kind)}
              onDirty={setDirty}
              onSaved={async () => {
                setDirty(false);
                await load(selection);
              }}
              onDeleted={async () => {
                setDirty(false);
                setSelection(null);
                await load();
              }}
              onError={setError}
            />
          ) : (
            <div className="grid min-h-96 place-items-center text-sm text-muted-foreground">
              Select a curriculum item.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TreeRow({
  depth,
  title,
  meta,
  active,
  onClick,
  onAdd,
  onUp,
  onDown,
  canReorder,
  hideMove,
  children,
}: {
  depth: number;
  title: string;
  meta: string;
  active: boolean;
  onClick: () => void;
  onAdd?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  canReorder?: boolean;
  hideMove?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = Children.count(children) > 0;
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "group flex min-w-0 max-w-full items-center rounded-lg",
          active ? "bg-primary/10 text-foreground" : "hover:bg-muted/60",
        )}
        style={{ paddingInlineStart: depth * 8 }}
      >
        {hasChildren ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
          >
            {open ? (
              <ChevronDown />
            ) : (
              <ChevronRight />
            )}
          </Button>
        ) : (
          <span
            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"
            aria-hidden="true"
          >
            <FileText className="size-4" />
          </span>
        )}
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 px-2 py-2 text-left"
        >
          <span className="block truncate text-xs font-medium">{title}</span>
          <span className="block truncate text-[9px] uppercase tracking-wide text-muted-foreground">
            {meta}
          </span>
        </button>
        <span className="flex shrink-0 opacity-100 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          {!hideMove && canReorder && (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={onUp}
                disabled={!onUp}
                aria-label={`Move ${title} up`}
              >
                <ChevronUp />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onDown}
                disabled={!onDown}
                aria-label={`Move ${title} down`}
              >
                <ChevronDown />
              </Button>
            </>
          )}
          {onAdd && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onAdd}
              aria-label={`Add child to ${title}`}
            >
              <Plus />
            </Button>
          )}
        </span>
      </div>
      {open && hasChildren ? children : null}
    </div>
  );
}

function countChildren(course: Course, item: NewItem) {
  if (item.kind === "version") return course.versions.length;
  if (item.kind === "chapter")
    return (
      course.versions.find((x) => x.id === item.parent)?.chapters.length || 0
    );
  if (item.kind === "subtopic")
    for (const v of course.versions)
      for (const c of v.chapters)
        if (c.id === item.parent) return c.subtopics.length;
  if (item.kind === "activity")
    for (const v of course.versions)
      for (const c of v.chapters)
        for (const s of c.subtopics)
          if (s.id === item.parent) return s.activities.length;
  return 0;
}
function CreateForm({
  item,
  count,
  onCancel,
  onCreated,
  onError,
}: {
  item: NewItem;
  course: Course;
  count: number;
  onCancel: () => void;
  onCreated: (s: Selection) => void;
  onError: (s: string) => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title"));
    try {
      let result: { id: string };
      if (item.kind === "version")
        result = await curriculumApi.createVersion({
          course: item.parent,
          version_number: Number(f.get("number")),
          name: title,
          status: "DRAFT",
        });
      else if (item.kind === "chapter")
        result = await curriculumApi.createChapter({
          course_version: item.parent,
          title,
          slug: String(f.get("slug")),
          description: String(f.get("description")),
          chapter_number: Number(f.get("number")),
          estimated_minutes: Number(f.get("minutes")),
          is_required: true,
          status: "DRAFT",
          display_order: count,
          completion_rule: {},
        });
      else if (item.kind === "subtopic")
        result = await curriculumApi.createSubtopic({
          chapter: item.parent,
          title,
          slug: String(f.get("slug")),
          description: String(f.get("description")),
          learning_objectives: [],
          estimated_minutes: Number(f.get("minutes")),
          display_order: count,
          is_required: true,
          status: "DRAFT",
        });
      else
        result = await curriculumApi.createActivity({
          subtopic: item.parent,
          title,
          description: String(f.get("description")),
          activity_type: String(f.get("activity_type")),
          estimated_minutes: Number(f.get("minutes")),
          display_order: count,
          is_required: true,
          status: "DRAFT",
          completion_rule: {},
        });
      onCreated({ kind: item.kind, id: result.id });
    } catch (x) {
      onError(
        x instanceof ApiError ? x.message : `Could not create ${item.kind}.`,
      );
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-2xl flex-col gap-5 rounded-xl border bg-card p-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-primary">
          New {item.kind}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Add {label(item.kind)}</h2>
      </div>
      <FieldGroup>
        <TextField label="Name / title" name="title" required />
        {item.kind !== "activity" && item.kind !== "version" && (
          <TextField
            label="Slug"
            name="slug"
            required
            pattern="[a-z0-9-]+"
          />
        )}
        {item.kind !== "version" && (
          <TextField label="Description" name="description" />
        )}
        {item.kind !== "version" && (
          <TextField
            label="Estimated minutes"
            name="minutes"
            type="number"
            defaultValue="0"
            required
          />
        )}
        {(item.kind === "version" || item.kind === "chapter") && (
          <TextField
            label={
              item.kind === "version" ? "Version number" : "Chapter number"
            }
            name="number"
            type="number"
            defaultValue={String(count + 1)}
            required
          />
        )}
        {item.kind === "activity" && (
          <Field>
            <FieldLabel htmlFor="activity_type">Activity type</FieldLabel>
            <Select
              name="activity_type"
              items={activityTypeOptions}
              defaultValue={activityTypes[0]}
              required
            >
              <SelectTrigger
                id="activity_type"
                className="w-full"
                aria-required="true"
              >
                <SelectValue placeholder="Select an activity type…" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} side="bottom">
                <SelectGroup>
                  {activityTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
      </FieldGroup>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          <X data-icon="inline-start" />
          Cancel
        </Button>
        <Button type="submit">
          <Plus data-icon="inline-start" />
          Create draft
        </Button>
      </div>
    </form>
  );
}

function TextField({
  label: fieldLabel,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <Field>
      <FieldLabel htmlFor={name}>{fieldLabel}</FieldLabel>
      <Input id={name} name={name} {...props} />
    </Field>
  );
}

function Inspector({
  course,
  selection,
  resource,
  canPublish,
  canEdit,
  onDirty,
  onSaved,
  onDeleted,
  onError,
}: {
  course: Course;
  selection: Selection;
  resource: SelectedResource;
  canPublish: boolean;
  canEdit: boolean;
  onDirty: (v: boolean) => void;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (v: string) => void;
}) {
  const initial = JSON.stringify(resource);
  const [version, setVersion] = useState(0);
  const isActivity = selection.kind === "activity";
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    const f = new FormData(e.currentTarget);
    try {
      const activityType =
        selection.kind === "activity" ? String(f.get("activity_type")) : "";
      const data: Record<string, unknown> = {
        status: f.get("status"),
        name: f.get("name") || undefined,
        title: f.get("title") || undefined,
        description: f.get("description") || "",
      };
      if (selection.kind === "version")
        data.version_number = Number(f.get("version_number"));
      else {
        data.estimated_minutes = Number(f.get("estimated_minutes"));
        data.is_required = f.get("is_required") === "on";
      }
      if (selection.kind === "chapter") {
        data.slug = f.get("slug");
        data.chapter_number = Number(f.get("chapter_number"));
        data.completion_rule = JSON.parse(
          String(f.get("completion_rule") || "{}"),
        );
      }
      if (selection.kind === "subtopic") {
        data.slug = f.get("slug");
        data.learning_objectives = String(f.get("learning_objectives") || "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
      }
      if (selection.kind === "activity") {
        data.activity_type = activityType;
        data.completion_rule = JSON.parse(
          String(f.get("completion_rule") || "{}"),
        );
      }
      Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
      await curriculumApi.update(
        resourceEndpoint[selection.kind],
        selection.id,
        data,
      );
      if (isActivity) {
        const activity = resource as Activity;
        const raw = String(f.get("content") || "{}");
        await curriculumApi.saveContent(
          activity.id,
          activity.content_record,
          String(f.get("content_type") || "application/json"),
          JSON.parse(raw),
        );
        if (
          experimentActivityTypes.has(activityType) ||
          Boolean(activity.experiment)
        ) {
          await curriculumApi.saveExperiment(activity.id, activity.experiment, {
            experiment_type: String(f.get("experiment_type")),
            instructions: String(f.get("experiment_instructions") || ""),
            configuration: JSON.parse(
              String(f.get("experiment_configuration") || "{}"),
            ),
            external_url:
              String(f.get("experiment_external_url") || "").trim() || null,
          });
        }
      }
      onSaved();
    } catch (x) {
      onError(
        x instanceof SyntaxError
          ? "Structured JSON is invalid."
          : x instanceof ApiError
            ? x.message
            : "Could not save changes.",
      );
    }
  }
  async function remove() {
    if (!canEdit) return;
    if (!confirm(`Delete this ${selection.kind}? This cannot be undone.`))
      return;
    try {
      await curriculumApi.remove(
        resourceEndpoint[selection.kind],
        selection.id,
      );
      onDeleted();
    } catch (x) {
      onError(
        x instanceof ApiError ? x.message : "Could not delete this item.",
      );
    }
  }
  async function publish() {
    if (
      !confirm("Publish this course version? Students may gain access to it.")
    )
      return;
    try {
      await curriculumApi.publish(course.id, resource.id);
      onSaved();
    } catch (x) {
      onError(x instanceof ApiError ? x.message : "Publication was blocked.");
    }
  }
  return (
    <form
      key={`${resource.id}-${version}`}
      onSubmit={save}
      onChange={() => canEdit && onDirty(true)}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
            {selection.kind}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {"name" in resource ? resource.name : resource.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">ID {resource.id}</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {resource.status}
        </span>
      </div>
      {!canEdit && (
        <Alert>
          <AlertDescription>
            You can review this {selection.kind}, but your role cannot change
            it.
          </AlertDescription>
        </Alert>
      )}
      <FieldSet
        disabled={!canEdit}
        className="rounded-xl border bg-card p-5 disabled:opacity-75"
      >
        <FieldLegend className="sr-only">
          {label(selection.kind)} details
        </FieldLegend>
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          {selection.kind === "version" ? (
            <TextField
              label="Version name"
              name="name"
              defaultValue={(resource as CourseVersion).name}
              required
            />
          ) : (
            <TextField
              label="Title"
              name="title"
              defaultValue={(resource as Chapter | Subtopic | Activity).title}
              required
            />
          )}
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <Select
              name="status"
              items={statusOptions}
              defaultValue={resource.status}
              onValueChange={() => canEdit && onDirty(true)}
              required
            >
              <SelectTrigger
                id="status"
                className="w-full"
                aria-required="true"
              >
                <SelectValue placeholder="Select a status…" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} side="bottom">
                <SelectGroup>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {selection.kind === "version" ? (
            <TextField
              label="Version number"
              name="version_number"
              type="number"
              defaultValue={(resource as CourseVersion).version_number}
            />
          ) : (
            <>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={
                    (resource as Chapter | Subtopic | Activity).description
                  }
                />
              </Field>
              <TextField
                label="Estimated minutes"
                name="estimated_minutes"
                type="number"
                defaultValue={
                  (resource as Chapter | Subtopic | Activity).estimated_minutes
                }
              />
              <Field orientation="horizontal" className="self-end pb-2">
                <Checkbox
                  id="is_required"
                  name="is_required"
                  defaultChecked={
                    (resource as Chapter | Subtopic | Activity).is_required
                  }
                  onCheckedChange={() => canEdit && onDirty(true)}
                />
                <FieldLabel htmlFor="is_required">Required</FieldLabel>
              </Field>
            </>
          )}
          {selection.kind === "chapter" && (
            <>
              <TextField
                label="Slug"
                name="slug"
                defaultValue={(resource as Chapter).slug}
              />
              <TextField
                label="Chapter number"
                name="chapter_number"
                type="number"
                defaultValue={(resource as Chapter).chapter_number}
              />
              <JsonField
                name="completion_rule"
                label="Completion rule"
                value={(resource as Chapter).completion_rule}
              />
            </>
          )}
          {selection.kind === "subtopic" && (
            <>
              <TextField
                label="Slug"
                name="slug"
                defaultValue={(resource as Subtopic).slug}
              />
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="learning_objectives">
                  Learning objectives, one per line
                </FieldLabel>
                <Textarea
                  id="learning_objectives"
                  name="learning_objectives"
                  defaultValue={(resource as Subtopic).learning_objectives.join(
                    "\n",
                  )}
                />
              </Field>
            </>
          )}
          {selection.kind === "activity" && (
            <ActivityFields
              activity={resource as Activity}
              onDirty={() => canEdit && onDirty(true)}
            />
          )}
        </FieldGroup>
      </FieldSet>
      <div
        className={cn(
          "flex flex-wrap gap-3",
          canEdit ? "justify-between" : "justify-end",
        )}
      >
        {canEdit && (
          <Button type="button" variant="destructive" onClick={remove}>
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        )}
        <div className="flex gap-2">
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setVersion((x) => x + 1);
                onDirty(false);
              }}
            >
              Cancel
            </Button>
          )}
          {selection.kind === "version" &&
            canPublish &&
            resource.status !== "PUBLISHED" && (
              <Button type="button" variant="outline" onClick={publish}>
                <Send data-icon="inline-start" />
                Publish
              </Button>
            )}
          {canEdit && (
            <Button type="submit">
              <Save data-icon="inline-start" />
              Save changes
            </Button>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Editing {selection.kind}
      </p>
      <span className="hidden">{initial}</span>
    </form>
  );
}
function ActivityFields({
  activity,
  onDirty,
}: {
  activity: Activity;
  onDirty: () => void;
}) {
  const [type, setType] = useState(activity.activity_type);
  const experiment = activity.experiment;
  return (
    <>
      <Field>
        <FieldLabel htmlFor="activity_type">Activity type</FieldLabel>
        <Select
          name="activity_type"
          items={activityTypeOptions}
          value={type}
          onValueChange={(value) => {
            if (!value) return;
            setType(String(value));
            onDirty();
          }}
          required
        >
          <SelectTrigger
            id="activity_type"
            className="w-full"
            aria-required="true"
          >
            <SelectValue placeholder="Select an activity type…" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} side="bottom">
            <SelectGroup>
              {activityTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <JsonField
        name="completion_rule"
        label="Completion rule"
        value={activity.completion_rule}
      />
      <TextField
        label="Content type"
        name="content_type"
        defaultValue={
          activity.content_record?.content_type || "application/json"
        }
      />
      <JsonField
        name="content"
        label="Structured activity content"
        value={activity.content_record?.content || {}}
      />
      {(experimentActivityTypes.has(type) || Boolean(experiment)) && (
        <>
          <Separator className="md:col-span-2" />
          <div className="md:col-span-2">
            <h3 className="font-semibold">Experiment module</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This declarative definition is delivered to students at runtime.
              GeoGebra can use a published material ID or a validated
              data-driven workspace.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="experiment_type">
              Experiment record type
            </FieldLabel>
            <Select
              name="experiment_type"
              items={experimentTypeOptions}
              defaultValue={experiment?.experiment_type || "EMBEDDED"}
              onValueChange={onDirty}
            >
              <SelectTrigger id="experiment_type" className="w-full">
                <SelectValue placeholder="Select an experiment type…" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} side="bottom">
                <SelectGroup>
                  {experimentTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <TextField
            label="External reference URL (optional)"
            name="experiment_external_url"
            type="url"
            defaultValue={experiment?.external_url || ""}
          />
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="experiment_instructions">
              Student instructions
            </FieldLabel>
            <Textarea
              id="experiment_instructions"
              name="experiment_instructions"
              defaultValue={experiment?.instructions || ""}
              required
            />
          </Field>
          <JsonField
            name="experiment_configuration"
            label="Experiment definition"
            value={experiment?.configuration || defaultExperimentConfiguration}
          />
        </>
      )}
    </>
  );
}
function JsonField({
  name,
  label: fieldLabel,
  value,
}: {
  name: string;
  label: string;
  value: Record<string, unknown>;
}) {
  return (
    <Field className="md:col-span-2">
      <FieldLabel htmlFor={name}>{fieldLabel} (JSON)</FieldLabel>
      <Textarea
        className="min-h-28 font-mono text-xs"
        id={name}
        name={name}
        defaultValue={JSON.stringify(value, null, 2)}
      />
    </Field>
  );
}
