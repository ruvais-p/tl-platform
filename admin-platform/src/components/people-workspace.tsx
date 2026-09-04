"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChartNoAxesCombined, Pencil, Plus, Search, UsersRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/curriculum/api";
import { peopleApi } from "@/lib/people/api";
import type { Person, PersonInput, RoleOption } from "@/lib/people/types";

const COLORS = ["#166534", "#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c"];
const labelRole = (role: string) => role.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const errorMessage = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;

function DonutChart({ title, values, total }: { title: string; values: { label: string; value: number; color: string }[]; total: number }) {
  let cursor = 0;
  const stops = values.map((item) => {
    const start = total ? cursor / total * 360 : 0;
    cursor += item.value;
    const end = total ? cursor / total * 360 : 0;
    return `${item.color} ${start}deg ${end}deg`;
  });
  return <section aria-label={title} className="border-t pt-5">
    <h2 className="text-sm font-semibold">{title}</h2>
    <div className="mt-5 flex items-center gap-6">
      <div className="relative size-32 shrink-0 rounded-full" role="img" aria-label={`${title}: ${values.map((item) => `${item.label} ${item.value}`).join(", ")}`} style={{ background: total ? `conic-gradient(${stops.join(",")})` : "#e5e7eb" }}>
        <div className="absolute inset-5 grid place-items-center rounded-full bg-[#f7f8f5]"><span className="text-2xl font-semibold">{total}</span></div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">{values.map((item) => <div key={item.label} className="flex items-center gap-2 text-xs"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span><span className="font-semibold tabular-nums">{item.value}</span></div>)}</div>
    </div>
  </section>;
}

function PersonForm({ roles, person, onSave, onClose }: { roles: RoleOption[]; person?: Person; onSave: (data: PersonInput) => Promise<void>; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const data: PersonInput = {
      email: String(form.get("email")), first_name: String(form.get("first_name")), last_name: String(form.get("last_name")),
      is_active: form.get("is_active") === "on", role_names: form.getAll("roles").map(String),
      ...(!person ? { password: String(form.get("password")) } : {}),
    };
    if (!data.role_names.length) { setError("Choose at least one role."); setSaving(false); return; }
    try { await onSave(data); onClose(); } catch (requestError) { setError(errorMessage(requestError, "Could not save this person.")); } finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="first_name">First name</Label><Input id="first_name" name="first_name" defaultValue={person?.first_name} required /></div><div className="space-y-2"><Label htmlFor="last_name">Last name</Label><Input id="last_name" name="last_name" defaultValue={person?.last_name} required /></div></div>
    <div className="space-y-2"><Label htmlFor="person-email">Email</Label><Input id="person-email" name="email" type="email" defaultValue={person?.email} required /></div>
    {!person && <div className="space-y-2"><Label htmlFor="password">Temporary password</Label><Input id="password" name="password" type="password" minLength={8} required /><p className="text-xs text-muted-foreground">Share this securely and ask the person to change it.</p></div>}
    <fieldset><legend className="text-sm font-medium">Roles</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{roles.map((role) => <label key={role.value} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm hover:bg-muted"><input type="checkbox" name="roles" value={role.value} defaultChecked={person?.groups.includes(role.value)} className="size-4 accent-emerald-700" />{role.label}</label>)}</div></fieldset>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={person?.is_active ?? true} className="size-4 accent-emerald-700" />Active account</label>
    <Button type="submit" className="w-full bg-emerald-800 hover:bg-emerald-900" disabled={saving}>{saving ? "Saving…" : person ? "Save changes" : "Add person"}</Button>
  </form>;
}

export function PeopleWorkspace() {
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [peopleList, roleList] = await Promise.all([peopleApi.people(), peopleApi.roles()]); setPeople(peopleList); setRoles(roleList); }
    catch (requestError) { setError(errorMessage(requestError, "Could not load people.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => people.filter((person) => {
    const matchesQuery = `${person.display_name} ${person.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (roleFilter === "ALL" || person.groups.includes(roleFilter));
  }), [people, query, roleFilter]);
  const roleValues = roles.map((role, index) => ({ label: role.label, value: people.filter((person) => person.groups.includes(role.value)).length, color: COLORS[index % COLORS.length] })).filter((item) => item.value);
  const active = people.filter((person) => person.is_active).length;
  const students = people.filter((person) => person.groups.includes("STUDENT")).length;

  async function create(data: PersonInput) { const person = await peopleApi.create(data); setPeople((current) => [...current, person].sort((a, b) => a.display_name.localeCompare(b.display_name))); }
  async function update(data: PersonInput) { if (!editing) return; const person = await peopleApi.update(editing.id, data); setPeople((current) => current.map((item) => item.id === person.id ? person : item)); }

  return <main className="mx-auto max-w-7xl p-5 md:p-9">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.17em] text-emerald-700">Organization</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">Human resources</h1><p className="mt-2 text-sm text-muted-foreground">Add people, manage access, and review your workforce mix.</p></div><Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogTrigger render={<Button className="bg-emerald-800 hover:bg-emerald-900" />}><Plus />Add person</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add person</DialogTitle><DialogDescription>Create an account for a staff member or student and assign their roles.</DialogDescription></DialogHeader><PersonForm roles={roles} onSave={create} onClose={() => setCreateOpen(false)} /></DialogContent></Dialog></header>
    {error && <Alert variant="destructive" className="mt-6"><AlertDescription>{error}</AlertDescription></Alert>}
    <section aria-label="People summary" className="mt-8 grid border-y sm:grid-cols-3"><div className="py-5 sm:border-r sm:px-5"><p className="text-xs text-muted-foreground">Total people</p><p className="mt-1 text-3xl font-semibold tabular-nums">{people.length}</p></div><div className="border-t py-5 sm:border-r sm:border-t-0 sm:px-5"><p className="text-xs text-muted-foreground">Active accounts</p><p className="mt-1 text-3xl font-semibold tabular-nums">{active}</p></div><div className="border-t py-5 sm:border-t-0 sm:px-5"><p className="text-xs text-muted-foreground">Students</p><p className="mt-1 text-3xl font-semibold tabular-nums">{students}</p></div></section>
    <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold">People directory</h2><p className="mt-1 text-xs text-muted-foreground">{filtered.length} of {people.length} people</p></div><div className="relative sm:ml-auto"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search people" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="pl-9 sm:w-64" /></div><select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-8 rounded-lg border bg-white px-3 text-sm"><option value="ALL">All roles</option>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div>
        {loading ? <div className="grid min-h-64 place-items-center text-sm text-muted-foreground" role="status">Loading people…</div> : filtered.length === 0 ? <div className="mt-6 grid min-h-64 place-items-center border-y text-center"><div><UsersRound className="mx-auto size-8 text-emerald-700" /><p className="mt-3 font-medium">No people found</p><p className="mt-1 text-xs text-muted-foreground">Try another search or role.</p></div></div> : <div className="mt-5 divide-y border-y">{filtered.map((person) => <div key={person.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(160px,auto)_90px_auto] md:items-center"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-900">{person.first_name[0]}{person.last_name[0]}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{person.display_name}</p><p className="truncate text-xs text-muted-foreground">{person.email}</p></div></div><div className="flex flex-wrap gap-1">{person.groups.map((role) => <Badge key={role} variant="outline" className="text-[10px]">{labelRole(role)}</Badge>)}</div><span className={`text-xs ${person.is_active ? "text-emerald-700" : "text-muted-foreground"}`}>{person.is_active ? "Active" : "Inactive"}</span><div className="flex gap-1">{person.groups.includes("STUDENT") && <Button asChild size="icon-sm" variant="ghost"><Link href={`/people/${person.id}`} aria-label={`Analyze ${person.display_name}`}><ChartNoAxesCombined /></Link></Button>}<Button size="icon-sm" variant="ghost" aria-label={`Edit ${person.display_name}`} onClick={() => setEditing(person)}><Pencil /></Button></div></div>)}</div>}
      </section>
      <aside aria-label="Resource charts" className="space-y-8"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Resource mix</p><p className="mt-2 text-sm">Live counts based on assigned roles and account status.</p></div><DonutChart title="People by role" values={roleValues} total={roleValues.reduce((sum, item) => sum + item.value, 0)} /><DonutChart title="Account status" values={[{ label: "Active", value: active, color: "#166534" }, { label: "Inactive", value: people.length - active, color: "#d1d5db" }]} total={people.length} /></aside>
    </div>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Manage person</DialogTitle><DialogDescription>Update account details, status, and assigned roles.</DialogDescription></DialogHeader>{editing && <PersonForm key={editing.id} person={editing} roles={roles} onSave={update} onClose={() => setEditing(null)} />}</DialogContent></Dialog>
  </main>;
}
