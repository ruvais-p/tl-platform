import { ApiError } from "@/lib/curriculum/api";
import type { ApiErrorBody, UUID } from "@/lib/curriculum/types";
import type { ApplicationStatus, OpportunityInput, StaffApplication, StaffOpportunity } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/staff/${path}`, {
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try { body = await response.json() as ApiErrorBody; } catch {}
    throw new ApiError(response.status, body);
  }
  return await response.json() as T;
}

async function download(path: string) {
  const response = await fetch(`/api/staff/${path}`);
  if (!response.ok) throw new ApiError(response.status, {});
  return response.blob();
}

function query(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export const staffOpportunityApi = {
  list: (filters: { search?: string; employment_type?: string; workplace_mode?: string; lifecycle_status?: string } = {}) =>
    request<StaffOpportunity[]>(`career-opportunities${query(filters)}`),
  get: (id: UUID) => request<StaffOpportunity>(`career-opportunities/${id}`),
  create: (data: OpportunityInput) => request<StaffOpportunity>("career-opportunities", { method: "POST", body: JSON.stringify(data) }),
  update: (id: UUID, data: Partial<OpportunityInput>) => request<StaffOpportunity>(`career-opportunities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  lifecycle: (id: UUID, action: "publish" | "close" | "archive") => request<StaffOpportunity>(`career-opportunities/${id}/${action}`, { method: "POST", body: "{}" }),
  applications: (filters: { opportunity?: UUID; status?: ApplicationStatus; search?: string } = {}) =>
    request<StaffApplication[]>(`opportunity-applications${query(filters)}`),
  application: (id: UUID) => request<StaffApplication>(`opportunity-applications/${id}`),
  transition: (id: UUID, status: ApplicationStatus, review_notes?: string) => request<StaffApplication>(`opportunity-applications/${id}/transition`, { method: "POST", body: JSON.stringify({ status, ...(review_notes === undefined ? {} : { review_notes }) }) }),
  reviewNote: (id: UUID, review_notes: string) => request<StaffApplication>(`opportunity-applications/${id}/review_note`, { method: "PATCH", body: JSON.stringify({ review_notes }) }),
  resume: (id: UUID) => download(`opportunity-applications/${id}/resume`),
};
