"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Database,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/curriculum/api";
import { staffApi, type StaffRecord } from "@/lib/staff/api";
import {
  staffResources,
  type FieldOption,
  type StaffFieldDefinition,
  type StaffResourceDefinition,
} from "@/lib/staff/resources";

type FormValues = Record<string, unknown>;
type RelationData = Record<string, StaffRecord[]>;

function hasPermission(permissions: string[] | undefined, permission?: string) {
  return Boolean(permission && permissions?.includes(permission));
}

function relationLabel(record: StaffRecord, keys: string[]) {
  const values = keys
    .map((key) => record[key])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(String);
  return values.join(" · ") || String(record.id);
}

function relationOptions(
  field: StaffFieldDefinition,
  relations: RelationData,
): FieldOption[] {
  if (!field.relation) return [];
  return (relations[field.relation.endpoint] || []).map((record) => ({
    label: relationLabel(record, field.relation!.labelKeys),
    value: String(record.id),
  }));
}

function initialFormValues(
  definition: StaffResourceDefinition,
  record: StaffRecord | null,
): FormValues {
  return Object.fromEntries(
    definition.fields
      .filter((field) => !(record && field.createOnly))
      .map((field) => {
        const raw = record ? record[field.key] : field.defaultValue;
        if (field.type === "json")
          return [field.key, JSON.stringify(raw ?? {}, null, 2)];
        if (field.type === "boolean") return [field.key, Boolean(raw)];
        if (field.type === "datetime" && raw) {
          return [field.key, new Date(String(raw)).toISOString().slice(0, 16)];
        }
        return [field.key, raw ?? ""];
      }),
  );
}

function fieldErrorsFromApi(error: ApiError) {
  return Object.fromEntries(
    Object.entries(error.body)
      .filter(([, value]) => Array.isArray(value) && value.length)
      .map(([key, value]) => [key, String((value as unknown[])[0])]),
  );
}

export function serializeValues(
  definition: StaffResourceDefinition,
  values: FormValues,
  editing: boolean,
) {
  const errors: Record<string, string> = {};
  const parsed: Record<string, unknown> = {};
  let hasFile = false;

  for (const field of definition.fields) {
    if (editing && field.createOnly) continue;
    const value = values[field.key];
    if (
      field.required &&
      (value === "" ||
        value === null ||
        value === undefined ||
        value === "__none__")
    ) {
      errors[field.key] = `${field.label} is required.`;
      continue;
    }
    if (field.type === "file") {
      if (value instanceof File) {
        parsed[field.key] = value;
        hasFile = true;
      }
      continue;
    }
    if (field.type === "json") {
      try {
        parsed[field.key] = JSON.parse(String(value || "{}"));
      } catch {
        errors[field.key] = "Enter valid JSON.";
      }
      continue;
    }
    if (field.type === "number") {
      if (value === "" || value === null || value === undefined) {
        if (field.nullable) parsed[field.key] = null;
      } else {
        parsed[field.key] = Number(value);
      }
      continue;
    }
    if (field.type === "datetime") {
      parsed[field.key] = value ? new Date(String(value)).toISOString() : null;
      continue;
    }
    if (field.type === "boolean") {
      parsed[field.key] = Boolean(value);
      continue;
    }
    if (
      (field.type === "relation" || field.type === "select") &&
      value === "__none__"
    ) {
      parsed[field.key] = null;
      continue;
    }
    if (value === "" && field.nullable) parsed[field.key] = null;
    else parsed[field.key] = value;
  }

  if (Object.keys(errors).length) return { errors, payload: null };
  if (!hasFile) return { errors, payload: parsed };

  const formData = new FormData();
  for (const [key, value] of Object.entries(parsed)) {
    if (value === null || value === undefined || value === "") continue;
    formData.append(
      key,
      value instanceof File
        ? value
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
    );
  }
  return { errors, payload: formData };
}

function statusLike(key: string, value: string) {
  return /(^|_)status$/.test(key) && /^[A-Za-z][A-Za-z_ ]+$/.test(value);
}

function statusLabel(value: string) {
  const normalized = value.replaceAll("_", " ").toLocaleLowerCase();
  return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
}

function formatValue(
  record: StaffRecord,
  key: string,
  definition: StaffResourceDefinition,
  relations: RelationData,
) {
  const value = record[key];
  const field = definition.fields.find((candidate) => candidate.key === key);
  if (field?.relation && value !== null && value !== undefined) {
    const related = (relations[field.relation.endpoint] || []).find(
      (candidate) => String(candidate.id) === String(value),
    );
    if (related) return relationLabel(related, field.relation.labelKeys);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(String).join(", ") || "—";
  if (value && typeof value === "object") return JSON.stringify(value);
  if (
    typeof value === "string" &&
    /(_at|date)$/.test(key) &&
    !Number.isNaN(Date.parse(value))
  ) {
    return new Date(value).toLocaleString();
  }
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
}

function SelectField({
  id,
  field,
  value,
  options,
  invalid,
  onChange,
}: {
  id: string;
  field: StaffFieldDefinition;
  value: unknown;
  options: FieldOption[];
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const nullableOptions = field.nullable
    ? [{ label: "None", value: "__none__" }, ...options]
    : options;
  const current =
    value === null || value === undefined || value === ""
      ? field.nullable
        ? "__none__"
        : undefined
      : String(value);

  return (
    <Select
      items={nullableOptions}
      value={current ?? null}
      name={field.key}
      required={field.required}
      onValueChange={(next) => onChange(String(next ?? ""))}
    >
      <SelectTrigger
        id={id}
        className="w-full"
        aria-invalid={invalid || undefined}
        aria-required={field.required || undefined}
      >
        <SelectValue placeholder={`Select ${field.label.toLowerCase()}…`} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} side="bottom">
        <SelectGroup>
          {nullableOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ResourceField({
  field,
  value,
  relations,
  error,
  onChange,
}: {
  field: StaffFieldDefinition;
  value: unknown;
  relations: RelationData;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const controlId = `resource-field-${field.key}`;
  const invalid = Boolean(error);

  if (field.type === "boolean") {
    return (
      <Field orientation="horizontal" data-invalid={invalid || undefined}>
        <Checkbox
          id={controlId}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
          aria-invalid={invalid || undefined}
        />
        <FieldLabel htmlFor={controlId}>{field.label}</FieldLabel>
        <FieldError>{error}</FieldError>
      </Field>
    );
  }

  const selectOptions =
    field.type === "relation"
      ? relationOptions(field, relations)
      : field.options || [];

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={controlId}>{field.label}</FieldLabel>
      {field.type === "textarea" || field.type === "json" ? (
        <Textarea
          id={controlId}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          rows={field.type === "json" ? 8 : 4}
          required={field.required}
          aria-invalid={invalid || undefined}
        />
      ) : field.type === "select" || field.type === "relation" ? (
        <SelectField
          id={controlId}
          field={field}
          value={value}
          options={selectOptions}
          invalid={invalid}
          onChange={onChange}
        />
      ) : (
        <Input
          id={controlId}
          type={field.type === "datetime" ? "datetime-local" : field.type}
          step={field.type === "number" ? "any" : undefined}
          value={field.type === "file" ? undefined : String(value ?? "")}
          onChange={(event) =>
            onChange(
              field.type === "file"
                ? (event.target.files?.[0] ?? null)
                : event.target.value,
            )
          }
          required={field.required}
          aria-invalid={invalid || undefined}
        />
      )}
      {field.help && <FieldDescription>{field.help}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function ResourceDialog({
  definition,
  record,
  relations,
  open,
  onOpenChange,
  onSaved,
}: {
  definition: StaffResourceDefinition;
  record: StaffRecord | null;
  relations: RelationData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: StaffRecord) => void;
}) {
  const [values, setValues] = useState<FormValues>(() =>
    initialFormValues(definition, record),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initialFormValues(definition, record));
      setErrors({});
      setMessage("");
    }
  }, [definition, open, record]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const serialized = serializeValues(definition, values, Boolean(record));
    if (!serialized.payload) {
      setErrors(serialized.errors);
      return;
    }
    setSaving(true);
    setErrors({});
    setMessage("");
    try {
      const saved = record
        ? await staffApi.update<StaffRecord>(
            `${definition.endpoint}/${record.id}`,
            serialized.payload,
          )
        : await staffApi.create<StaffRecord>(
            definition.endpoint,
            serialized.payload,
          );
      onSaved(saved);
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(fieldErrorsFromApi(caught));
        setMessage(caught.message);
      } else {
        setMessage("The platform could not save this record.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {record ? "Edit" : "Create"} {definition.singular}
          </DialogTitle>
          <DialogDescription>{definition.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup>
            {definition.fields
              .filter((field) => !(record && field.createOnly))
              .map((field) => (
                <ResourceField
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  relations={relations}
                  error={errors[field.key]}
                  onChange={(value) =>
                    setValues((current) => ({ ...current, [field.key]: value }))
                  }
                />
              ))}
          </FieldGroup>
          {message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResourceWorkspace({ resourceKey }: { resourceKey: string }) {
  const definition = staffResources[resourceKey];
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<StaffRecord[]>([]);
  const [relations, setRelations] = useState<RelationData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRecord | null>(null);

  const canView = hasPermission(user?.permissions, definition?.viewPermission);
  const canAdd = hasPermission(user?.permissions, definition?.addPermission);
  const canChange = hasPermission(
    user?.permissions,
    definition?.changePermission,
  );
  const sectionHref =
    definition?.section === "curriculum"
      ? "/courses"
      : `/${definition?.section}`;

  async function load() {
    if (!definition || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const endpoints = [
        ...new Set(
          definition.fields
            .map((field) => field.relation?.endpoint)
            .filter((endpoint): endpoint is string => Boolean(endpoint)),
        ),
      ];
      const [nextRecords, relationEntries] = await Promise.all([
        staffApi.list<StaffRecord>(definition.endpoint),
        Promise.all(
          endpoints.map(
            async (endpoint) =>
              [endpoint, await staffApi.list<StaffRecord>(endpoint)] as const,
          ),
        ),
      ]);
      setRecords(nextRecords);
      setRelations(Object.fromEntries(relationEntries));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The platform could not load this workspace.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) void load();
    // The definition is stable for the life of this route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canView, resourceKey]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || !definition) return records;
    return records.filter((record) =>
      definition.columns.some((column) =>
        formatValue(record, column.key, definition, relations)
          .toLowerCase()
          .includes(normalized),
      ),
    );
  }, [definition, query, records, relations]);

  if (!definition) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-5 p-5 md:p-9">
        <Alert variant="destructive">
          <AlertDescription>
            This management workspace does not exist.
          </AlertDescription>
        </Alert>
        <Button
          render={<Link href="/dashboard" />}
          nativeButton={false}
          variant="outline"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to dashboard
        </Button>
      </main>
    );
  }

  if (!authLoading && !canView) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-5 p-5 md:p-9">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
            {definition.section}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {definition.title} unavailable
          </h1>
        </div>
        <Alert>
          <ShieldAlert />
          <AlertTitle>View access is required</AlertTitle>
          <AlertDescription>
            Your role does not have permission to view{" "}
            {definition.title.toLowerCase()}.
          </AlertDescription>
        </Alert>
        <Button
          render={<Link href="/dashboard" />}
          nativeButton={false}
          variant="outline"
          className="w-fit"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to dashboard
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 p-5 md:p-9">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Button
            render={<Link href={sectionHref} />}
            nativeButton={false}
            variant="ghost"
          >
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
            {definition.section}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {definition.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {definition.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!canAdd && !canChange && (
            <span className="text-xs text-muted-foreground">View only</span>
          )}
          {canAdd && definition.fields.length > 0 && (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus data-icon="inline-start" />
              New {definition.singular}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <InputGroup className="max-w-md">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${definition.title.toLowerCase()}…`}
            aria-label={`Search ${definition.title.toLowerCase()}`}
          />
        </InputGroup>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void load()}
            aria-label="Refresh records"
            disabled={loading}
          >
            {loading ? <Spinner /> : <RefreshCw />}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-72 place-items-center" role="status">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database />
            </EmptyMedia>
            <EmptyTitle>No {definition.title.toLowerCase()} found</EmptyTitle>
            <EmptyDescription>
              {query
                ? "Try a different search."
                : canAdd
                  ? `Create the first ${definition.singular} when you are ready.`
                  : "No records are currently available to your role."}
            </EmptyDescription>
          </EmptyHeader>
          {canAdd && definition.fields.length > 0 && !query && (
            <EmptyContent>
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus data-icon="inline-start" />
                New {definition.singular}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <p className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground md:hidden">
            <ArrowLeftRight />
            Swipe horizontally to view all columns
            {canChange && definition.fields.length > 0 ? " and actions" : ""}.
          </p>
          <Table className="min-w-max tabular-nums">
            <TableHeader>
              <TableRow>
                {definition.columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
                {canChange && definition.fields.length > 0 && (
                  <TableHead className="sticky right-0 border-l bg-card text-right">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow key={String(record.id)} className="group">
                  {definition.columns.map((column) => {
                    const value = formatValue(
                      record,
                      column.key,
                      definition,
                      relations,
                    );
                    return (
                      <TableCell key={column.key} className="max-w-80 truncate">
                        {statusLike(column.key, value) ? (
                          <span className="text-xs text-muted-foreground">
                            {statusLabel(value)}
                          </span>
                        ) : (
                          value
                        )}
                      </TableCell>
                    );
                  })}
                  {canChange && definition.fields.length > 0 && (
                    <TableCell className="sticky right-0 border-l bg-card text-right group-hover:bg-muted/50">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(record);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ResourceDialog
        key={`${definition.key}-${editing?.id ?? "new"}`}
        definition={definition}
        record={editing}
        relations={relations}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(saved) => {
          setRecords((current) =>
            editing
              ? current.map((record) =>
                  record.id === saved.id ? saved : record,
                )
              : [saved, ...current],
          );
        }}
      />
    </main>
  );
}
