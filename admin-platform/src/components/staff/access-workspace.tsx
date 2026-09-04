"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/curriculum/api";
import { staffApi, type StaffRecord } from "@/lib/staff/api";

type ManagedUser = StaffRecord & {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
  is_active: boolean;
  groups: string[];
  permissions: string[];
};

type Role = StaffRecord & {
  id: number;
  name: string;
  user_count: number;
  permissions: string[];
};

type PermissionItem = StaffRecord & {
  id: number;
  key: string;
  name: string;
  app_label: string;
  codename: string;
};

type UserFormState = {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  is_active: boolean;
  groups: string[];
};

const emptyUser: UserFormState = {
  email: "",
  username: "",
  first_name: "",
  last_name: "",
  password: "",
  is_active: true,
  groups: [],
};

function UserDialog({
  user,
  roles,
  canManagePermissions,
  open,
  onOpenChange,
  onSaved,
}: {
  user: ManagedUser | null;
  roles: Role[];
  canManagePermissions: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: ManagedUser) => void;
}) {
  const [form, setForm] = useState<UserFormState>(emptyUser);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      user
        ? {
            email: user.email,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            password: "",
            is_active: user.is_active,
            groups: [...user.groups],
          }
        : emptyUser,
    );
    setFieldErrors({});
    setMessage("");
  }, [open, user]);

  function toggleRole(role: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      groups: checked
        ? [...new Set([...current.groups, role])]
        : current.groups.filter((currentRole) => currentRole !== role),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setMessage("");
    const payload: Record<string, unknown> = {
      email: form.email,
      username: form.username,
      first_name: form.first_name,
      last_name: form.last_name,
      is_active: form.is_active,
      groups: form.groups,
    };
    if (form.password) payload.password = form.password;
    try {
      const saved = user
        ? await staffApi.update<ManagedUser>(`auth/users/${user.id}`, payload)
        : await staffApi.create<ManagedUser>("auth/users", payload);
      onSaved(saved);
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setMessage(caught.message);
        setFieldErrors(
          Object.fromEntries(
            Object.entries(caught.body)
              .filter(([, value]) => Array.isArray(value) && value.length)
              .map(([key, value]) => [key, String((value as unknown[])[0])]),
          ),
        );
      } else {
        setMessage("The platform could not save this user.");
      }
    } finally {
      setSaving(false);
    }
  }

  const assignableRoles = roles.filter(
    (role) => canManagePermissions || role.name !== "SUPER_ADMIN",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Create user"}</DialogTitle>
          <DialogDescription>
            Manage identity, login state, and role membership.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field data-invalid={Boolean(fieldErrors.email) || undefined}>
              <FieldLabel htmlFor="managed-email">Email address</FieldLabel>
              <Input
                id="managed-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                required
                aria-invalid={Boolean(fieldErrors.email) || undefined}
              />
              <FieldError>{fieldErrors.email}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fieldErrors.username) || undefined}>
              <FieldLabel htmlFor="managed-username">Username</FieldLabel>
              <Input
                id="managed-username"
                value={form.username}
                onChange={(event) =>
                  setForm({ ...form, username: event.target.value })
                }
                required
                aria-invalid={Boolean(fieldErrors.username) || undefined}
              />
              <FieldError>{fieldErrors.username}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="managed-first-name">First name</FieldLabel>
                <Input
                  id="managed-first-name"
                  value={form.first_name}
                  onChange={(event) =>
                    setForm({ ...form, first_name: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="managed-last-name">Last name</FieldLabel>
                <Input
                  id="managed-last-name"
                  value={form.last_name}
                  onChange={(event) =>
                    setForm({ ...form, last_name: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field data-invalid={Boolean(fieldErrors.password) || undefined}>
              <FieldLabel htmlFor="managed-password">
                {user ? "New password" : "Password"}
              </FieldLabel>
              <Input
                id="managed-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                required={!user}
                aria-invalid={Boolean(fieldErrors.password) || undefined}
              />
              <FieldDescription>
                {user
                  ? "Leave blank to keep the current password."
                  : "Django’s configured password policy is enforced."}
              </FieldDescription>
              <FieldError>{fieldErrors.password}</FieldError>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="managed-active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_active: Boolean(checked) })
                }
              />
              <FieldLabel htmlFor="managed-active">Active account</FieldLabel>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Roles</FieldLegend>
              <FieldDescription>
                Roles determine the user’s effective dashboard and backend
                permissions.
              </FieldDescription>
              <FieldGroup
                data-slot="checkbox-group"
                className="grid gap-3 sm:grid-cols-2"
              >
                {assignableRoles.map((role) => (
                  <Field key={role.id} orientation="horizontal">
                    <Checkbox
                      id={`managed-role-${role.id}`}
                      checked={form.groups.includes(role.name)}
                      onCheckedChange={(checked) =>
                        toggleRole(role.name, Boolean(checked))
                      }
                    />
                    <FieldLabel htmlFor={`managed-role-${role.id}`}>
                      {role.name.replaceAll("_", " ")}
                    </FieldLabel>
                  </Field>
                ))}
              </FieldGroup>
            </FieldSet>
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
              {saving ? "Saving…" : "Save user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RolePermissionsDialog({
  role,
  permissions,
  open,
  onOpenChange,
  onSaved,
}: {
  role: Role | null;
  permissions: PermissionItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (role: Role) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [permissionQuery, setPermissionQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && role) {
      setSelected([...role.permissions]);
      setPermissionQuery("");
      setError("");
    }
  }, [open, role]);

  const filteredPermissions = useMemo(() => {
    const normalized = permissionQuery.trim().toLowerCase();
    if (!normalized) return permissions;
    return permissions.filter((permission) =>
      [
        permission.name,
        permission.key,
        permission.app_label,
        permission.codename,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [permissionQuery, permissions]);

  const grouped = useMemo(
    () =>
      Object.entries(
        filteredPermissions.reduce<Record<string, PermissionItem[]>>(
          (result, permission) => {
            (result[permission.app_label] ||= []).push(permission);
            return result;
          },
          {},
        ),
      ),
    [filteredPermissions],
  );

  async function save() {
    if (!role) return;
    setSaving(true);
    setError("");
    try {
      const updated = await staffApi.update<Role>(
        `auth/groups/${role.id}/permissions`,
        { permissions: selected },
      );
      onSaved(updated);
      onOpenChange(false);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The platform could not update this role.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Permissions for {role?.name.replaceAll("_", " ")}
          </DialogTitle>
          <DialogDescription>
            Changes take effect immediately and may be reset by the setup_groups
            synchronization command.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={permissionQuery}
              onChange={(event) => setPermissionQuery(event.target.value)}
              placeholder="Search permissions…"
              aria-label="Search permissions"
            />
          </InputGroup>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {filteredPermissions.length} of {permissions.length} permissions
          </span>
        </div>
        <div className="flex flex-col gap-4">
          {grouped.length ? (
            grouped.map(([appLabel, appPermissions]) => (
              <FieldSet key={appLabel} className="rounded-lg border p-4">
                <FieldLegend variant="label">
                  {appLabel.replaceAll("_", " ")}
                </FieldLegend>
                <FieldGroup
                  data-slot="checkbox-group"
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {appPermissions.map((permission) => (
                    <Field key={permission.id} orientation="horizontal">
                      <Checkbox
                        id={`permission-${permission.id}`}
                        checked={selected.includes(permission.key)}
                        onCheckedChange={(checked) =>
                          setSelected((current) =>
                            checked
                              ? [...new Set([...current, permission.key])]
                              : current.filter(
                                  (key) => key !== permission.key,
                                ),
                          )
                        }
                      />
                      <FieldLabel htmlFor={`permission-${permission.id}`}>
                        {permission.name}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            ))
          ) : (
            <Empty className="min-h-40 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>No permissions found</EmptyTitle>
                <EmptyDescription>
                  Try a permission name, app, or codename.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Spinner data-icon="inline-start" />}
            {saving ? "Saving…" : "Save permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccessWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const canManageUsers = Boolean(
    user?.permissions.includes("accounts.manage_users"),
  );
  const canManagePermissions = Boolean(
    user?.permissions.includes("accounts.manage_permissions"),
  );
  const canCreateUsers = Boolean(
    user?.permissions.includes("accounts.add_user"),
  );
  const canChangeUsers = Boolean(
    user?.permissions.includes("accounts.change_user"),
  );

  async function load() {
    if (!canManageUsers) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextUsers, nextRoles, nextPermissions] = await Promise.all([
        staffApi.list<ManagedUser>("auth/users"),
        staffApi.list<Role>("auth/groups"),
        canManagePermissions
          ? staffApi.list<PermissionItem>("auth/permissions")
          : Promise.resolve([]),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setPermissions(nextPermissions);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The platform could not load access control.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManagePermissions, canManageUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((candidate) =>
      [
        candidate.email,
        candidate.username,
        candidate.display_name,
        ...candidate.groups,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, users]);

  if (!authLoading && !canManageUsers) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-5 p-5 md:p-9">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Access unavailable
          </h1>
        </div>
        <Alert>
          <ShieldCheck />
          <AlertTitle>User-management access is required</AlertTitle>
          <AlertDescription>Your role cannot manage users.</AlertDescription>
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
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-5 md:p-9">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Access control
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create accounts, assign guarded roles, and review permission
            coverage.
          </p>
        </div>
        {canCreateUsers && (
          <Button
            onClick={() => {
              setSelectedUser(null);
              setUserDialogOpen(true);
            }}
          >
            <Plus data-icon="inline-start" />
            New user
          </Button>
        )}
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Access summary"
      >
        <Card size="sm">
          <CardHeader>
            <CardDescription>Users</CardDescription>
            <CardTitle className="tabular-nums">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Roles</CardDescription>
            <CardTitle className="tabular-nums">{roles.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Permission definitions</CardDescription>
            <CardTitle className="tabular-nums">
              {canManagePermissions ? permissions.length : "Restricted"}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="users-heading">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="users-heading" className="text-xl font-semibold">
              Users
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Active and inactive staff and learner accounts.
            </p>
          </div>
          <InputGroup className="max-w-sm">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users…"
              aria-label="Search users"
            />
          </InputGroup>
        </div>
        {loading ? (
          <div className="grid min-h-48 place-items-center" role="status">
            <Spinner />
          </div>
        ) : filteredUsers.length === 0 ? (
          <Empty className="min-h-48 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserRound />
              </EmptyMedia>
              <EmptyTitle>No users found</EmptyTitle>
              <EmptyDescription>
                Try another search or create a user.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <p className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground md:hidden">
              <ArrowLeftRight />
              Swipe horizontally to view all columns
              {canChangeUsers ? " and actions" : ""}.
            </p>
            <Table className="min-w-max tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  {canChangeUsers && (
                    <TableHead className="sticky right-0 border-l bg-card text-right">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((candidate) => (
                  <TableRow key={candidate.id} className="group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {candidate.display_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {candidate.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{candidate.username}</TableCell>
                    <TableCell className="max-w-80">
                      <div className="flex flex-wrap gap-1">
                        {candidate.groups.length
                          ? candidate.groups.map((group) => (
                              <span
                                key={group}
                                className="text-xs text-muted-foreground"
                              >
                                {group.replaceAll("_", " ")}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          candidate.is_active
                            ? "text-xs text-success"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {candidate.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    {canChangeUsers && (
                      <TableCell className="sticky right-0 border-l bg-card text-right group-hover:bg-muted/50">
                        {canManagePermissions ||
                        !candidate.groups.includes("SUPER_ADMIN") ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setSelectedUser(candidate);
                              setUserDialogOpen(true);
                            }}
                          >
                            <Pencil data-icon="inline-start" />
                            Edit
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Protected
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="roles-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="roles-heading" className="text-xl font-semibold">
              Roles
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Synchronized Django groups and their permission coverage.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh access control"
          >
            {loading ? <Spinner /> : <RefreshCw />}
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <ShieldCheck />
                <CardTitle>{role.name.replaceAll("_", " ")}</CardTitle>
                <CardDescription className="tabular-nums">
                  {role.user_count} user{role.user_count === 1 ? "" : "s"} ·{" "}
                  {role.permissions.length} permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canManagePermissions ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedRole(role);
                      setRoleDialogOpen(true);
                    }}
                  >
                    <KeyRound data-icon="inline-start" />
                    Edit permissions
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Permission editing requires SUPER_ADMIN authority.
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <UserDialog
        key={selectedUser?.id ?? "new-user"}
        user={selectedUser}
        roles={roles}
        canManagePermissions={canManagePermissions}
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        onSaved={(saved) =>
          setUsers((current) =>
            selectedUser
              ? current.map((candidate) =>
                  candidate.id === saved.id ? saved : candidate,
                )
              : [saved, ...current],
          )
        }
      />
      <RolePermissionsDialog
        key={selectedRole?.id ?? "role"}
        role={selectedRole}
        permissions={permissions}
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        onSaved={(saved) =>
          setRoles((current) =>
            current.map((role) => (role.id === saved.id ? saved : role)),
          )
        }
      />
    </main>
  );
}
