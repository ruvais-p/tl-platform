import type { ApiErrorBody } from "@/lib/curriculum/types";
import type {
  ActivityProgress,
  AssessmentAttempt,
  CareerOpportunity,
  Course,
  CourseChatResponse,
  CourseProgress,
  Gamification,
  LearningCheck,
  LearnerApplication,
  MediaAsset,
  User,
  UUID,
  Video,
} from "./types";
import type { EmploymentType, WorkplaceMode } from "@/lib/opportunities/types";

function errorMessage(body: ApiErrorBody, status: number) {
  if (body.error?.message) return body.error.message;
  if (body.detail) return body.detail;
  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value) && value.length) return `${key.replaceAll("_", " ")}: ${String(value[0])}`;
  }
  return `Request failed (${status})`;
}

export class LearnerApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(errorMessage(body, status));
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(`/api/learner/${path}`, {
    ...init,
    headers: {
      ...(init?.body && !isForm ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try { body = await response.json() as ApiErrorBody; } catch {}
    throw new LearnerApiError(response.status, body);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

async function download(path: string) {
  const response = await fetch(`/api/learner/${path}`);
  if (!response.ok) throw new LearnerApiError(response.status, {});
  return response.blob();
}

const json = (value: unknown) => JSON.stringify(value);

export const learnerAuthApi = {
  me: () => request<User>("auth/me"),
  login: (email: string, password: string) => request<{ ok: true }>("auth/login", {
    method: "POST",
    body: json({ email, password }),
  }),
  logout: () => request<{ redirect_to: string; auth0: boolean }>("auth/logout", { method: "POST" }),
};

export const learnerApi = {
  courses: () => request<Course[]>("data/courses"),
  course: (id: UUID) => request<Course>(`data/courses/${id}`),
  activityProgress: (course?: UUID) => request<ActivityProgress[]>(`data/me/activity-progress${course ? `?course=${encodeURIComponent(course)}` : ""}`),
  courseProgress: async (course: UUID) => {
    try {
      return await request<CourseProgress>(`data/me/courses/${course}/progress`);
    } catch (error) {
      if (error instanceof LearnerApiError && error.status === 404) return null;
      throw error;
    }
  },
  videos: () => request<Video[]>("data/videos"),
  mediaAssets: () => request<MediaAsset[]>("data/media-assets"),
  learningChecks: () => request<LearningCheck[]>("data/learning-checks"),
  learningCheck: (id: UUID) => request<LearningCheck>(`data/learning-checks/${id}`),
  gamification: () => request<Gamification>("data/gamification/me"),
  opportunities: (filters: { search?: string; employment_type?: EmploymentType; workplace_mode?: WorkplaceMode } = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return request<CareerOpportunity[]>(`data/career/opportunities${params.size ? `?${params}` : ""}`);
  },
  opportunity: (id: UUID) => request<CareerOpportunity>(`data/career/opportunities/${id}`),
  apply: (id: UUID, data: { contact_phone: string; cover_note?: string; resume?: File }) => {
    const form = new FormData();
    form.set("contact_phone", data.contact_phone);
    if (data.cover_note) form.set("cover_note", data.cover_note);
    if (data.resume) form.set("resume", data.resume);
    return request<LearnerApplication>(`data/career/opportunities/${id}/applications`, { method: "POST", body: form });
  },
  applications: () => request<LearnerApplication[]>("data/career/applications/me"),
  withdrawApplication: (id: UUID) => request<LearnerApplication>(`data/career/applications/${id}/withdraw`, { method: "POST", body: "{}" }),
  applicationResume: (id: UUID) => download(`data/career/applications/${id}/resume`),
  sendCourseChat: (course: UUID, message: string, sessionId?: UUID | null) => request<CourseChatResponse>(`data/courses/${course}/chat`, {
    method: "POST",
    body: json({ message, ...(sessionId ? { session_id: sessionId } : {}) }),
  }),
  startActivity: (id: UUID) => request<ActivityProgress>(`data/activities/${id}/start`, { method: "POST", body: "{}" }),
  saveActivity: (id: UUID, data: { progress_percentage?: number; time_spent_seconds?: number; metadata?: Record<string, unknown> }) => request<ActivityProgress>(`data/activities/${id}/progress`, { method: "POST", body: json(data) }),
  completeActivity: (id: UUID, data: { time_spent_seconds?: number; metadata?: Record<string, unknown> } = {}) => request<ActivityProgress>(`data/activities/${id}/complete`, { method: "POST", body: json(data) }),
  startCheck: (id: UUID) => request<AssessmentAttempt>(`data/learning-checks/${id}/start`, { method: "POST", body: "{}" }),
  submitCheck: (id: UUID, attemptId: UUID, answers: Array<{ question: UUID; answer: unknown }>, timeSpentSeconds: number) => request<AssessmentAttempt>(`data/learning-checks/${id}/submit`, {
    method: "POST",
    body: json({ attempt_id: attemptId, answers, time_spent_seconds: timeSpentSeconds }),
  }),
  checkResults: (id: UUID) => request<AssessmentAttempt[]>(`data/learning-checks/${id}/results`),
};
