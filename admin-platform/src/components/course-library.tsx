"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, BookOpen, Plus, RefreshCw, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, curriculumApi } from "@/lib/curriculum/api";
import type { Course, Program } from "@/lib/curriculum/types";

type CourseDraft = {
  program: string;
  name: string;
  code: string;
  description: string;
};
const emptyDraft: CourseDraft = {
  program: "",
  name: "",
  code: "",
  description: "",
};

export function CourseLibrary() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CourseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const canCreateCourse = Boolean(
    user?.permissions.includes("curriculum.add_course"),
  );
  const canManagePrograms = Boolean(
    user?.permissions.includes("curriculum.view_program"),
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextCourses, nextPrograms] = await Promise.all([
        curriculumApi.courses(),
        curriculumApi.programs(),
      ]);
      setCourses(nextCourses);
      setPrograms(nextPrograms);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not load courses.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFieldError("");
    try {
      const course = await curriculumApi.createCourse({
        ...draft,
        status: "DRAFT",
        display_order: courses.length,
      });
      setOpen(false);
      setDraft(emptyDraft);
      router.push(`/courses/${course.id}`);
    } catch (caught) {
      setFieldError(
        caught instanceof ApiError
          ? caught.message
          : "Could not create course.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-7 p-5 md:p-9">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
            Curriculum
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Course library
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a course to shape its learning structure.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManagePrograms && (
            <Button
              render={<Link href="/manage/programs" />}
              nativeButton={false}
              variant="outline"
            >
              <Settings2 data-icon="inline-start" />
              Programs
            </Button>
          )}
          <Button
            render={<Link href="/manage/courses" />}
            nativeButton={false}
            variant="outline"
          >
            <Settings2 data-icon="inline-start" />
            Course settings
          </Button>
          {canCreateCourse && (
            <Button onClick={() => setOpen(true)}>
              <Plus data-icon="inline-start" />
              New course
            </Button>
          )}
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid min-h-80 place-items-center" role="status">
          <Spinner />
        </div>
      ) : courses.length === 0 ? (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>No courses yet</EmptyTitle>
            <EmptyDescription>
              {canCreateCourse
                ? "Create the first course when a program is ready."
                : "No courses are available to your role."}
            </EmptyDescription>
          </EmptyHeader>
          {canCreateCourse && (
            <EmptyContent>
              <Button onClick={() => setOpen(true)}>
                <Plus data-icon="inline-start" />
                New course
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {courses.map((course) => (
            <Link
              href={`/courses/${course.id}`}
              key={course.id}
              className="group grid gap-3 p-5 transition-colors hover:bg-muted/50 md:grid-cols-[1fr_180px_120px_32px] md:items-center"
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {course.program_name}
                </p>
                <h2 className="mt-1 font-semibold">{course.name}</h2>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {course.description || "No description"}
                </p>
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {course.versions.length} version
                {course.versions.length === 1 ? "" : "s"}
              </p>
              <span className="w-fit text-xs font-medium text-muted-foreground">
                {course.status.replaceAll("_", " ")}
              </span>
              <ArrowRight className="transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      )}

      {!loading && error && (
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create course</DialogTitle>
            <DialogDescription>
              New courses begin as drafts in the selected program.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="flex flex-col gap-5">
            <FieldGroup>
              <Field data-invalid={Boolean(fieldError) || undefined}>
                <FieldLabel htmlFor="course-program">Program</FieldLabel>
                <Select
                  items={programs.map((program) => ({
                    label: program.name,
                    value: program.id,
                  }))}
                  name="program"
                  required
                  value={draft.program || null}
                  onValueChange={(value) =>
                    setDraft({ ...draft, program: String(value ?? "") })
                  }
                >
                  <SelectTrigger
                    id="course-program"
                    className="w-full"
                    aria-invalid={Boolean(fieldError) || undefined}
                    aria-required="true"
                  >
                    <SelectValue placeholder="Select a program…" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} side="bottom">
                    <SelectGroup>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{fieldError}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="course-name">Name</FieldLabel>
                <Input
                  id="course-name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="course-code">Unique code</FieldLabel>
                <Input
                  id="course-code"
                  value={draft.code}
                  onChange={(event) =>
                    setDraft({ ...draft, code: event.target.value })
                  }
                  pattern="[a-z0-9-]+"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="course-description">
                  Description
                </FieldLabel>
                <Textarea
                  id="course-description"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !draft.program}>
                {saving && <Spinner data-icon="inline-start" />}
                {saving ? "Creating…" : "Create course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
