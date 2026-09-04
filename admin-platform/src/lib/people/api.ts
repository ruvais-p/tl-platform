import { ApiError } from "@/lib/curriculum/api";
import type { ApiErrorBody, UUID } from "@/lib/curriculum/types";
import type { Person, PersonInput, RoleOption, StudentAnalytics } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers } });
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try { body = await response.json() as ApiErrorBody; } catch {}
    throw new ApiError(response.status, body);
  }
  return await response.json() as T;
}

export const peopleApi = {
  people: () => request<Person[]>("/api/staff/auth/users"),
  roles: async () => (await request<{ name: string }[]>("/api/staff/auth/groups")).map((role) => ({ value: role.name, label: role.name.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "), protected: role.name === "SUPER_ADMIN" } satisfies RoleOption)),
  create: (data: PersonInput) => request<Person>("/api/staff/auth/users", { method: "POST", body: JSON.stringify({ ...data, username: data.email.split("@", 1)[0], groups: data.role_names, role_names: undefined }) }),
  update: (id: UUID, data: Partial<PersonInput>) => request<Person>(`/api/staff/auth/users/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, groups: data.role_names, role_names: undefined }) }),
  studentAnalytics: (id: UUID) => request<StudentAnalytics>(`/api/people/students/${id}/analytics`),
};
