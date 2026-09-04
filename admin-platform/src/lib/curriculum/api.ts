import type { Activity, ApiErrorBody, Chapter, ContentRecord, Course, CourseVersion, ExperimentRecord, Program, Subtopic, User, UUID } from "./types";

function errorMessage(body:ApiErrorBody,status:number){if(body.error?.message)return body.error.message;if(body.detail)return body.detail;for(const[key,value]of Object.entries(body)){if(Array.isArray(value)&&value.length)return `${key.replaceAll("_"," ")}: ${String(value[0])}`}return `Request failed (${status})`}
export class ApiError extends Error { constructor(public status: number, public body: ApiErrorBody) { super(errorMessage(body,status)); } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, { ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers } });
  if (!response.ok) { let body: ApiErrorBody = {}; try { body = await response.json() as ApiErrorBody; } catch {} throw new ApiError(response.status, body); }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
const json = (value: unknown) => JSON.stringify(value);
export const authApi = { me: () => request<User>("auth/me"), login: (email: string, password: string) => request<{ok:true}>("auth/login", { method:"POST", body:json({email,password}) }), logout: () => request<void>("auth/logout", {method:"POST"}) };
export const curriculumApi = {
  programs: () => request<Program[]>("curriculum/programs"), courses: () => request<Course[]>("curriculum/courses"), course: (id: UUID) => request<Course>(`curriculum/courses/${id}`),
  createProgram: (data: Partial<Program>) => request<Program>("curriculum/programs", {method:"POST",body:json(data)}),
  createCourse: (data: Partial<Course>) => request<Course>("curriculum/courses", {method:"POST",body:json(data)}),
  createVersion: (data: Partial<CourseVersion>) => request<CourseVersion>("curriculum/course-versions", {method:"POST",body:json(data)}),
  createChapter: (data: Partial<Chapter>) => request<Chapter>("curriculum/chapters", {method:"POST",body:json(data)}),
  createSubtopic: (data: Partial<Subtopic>) => request<Subtopic>("curriculum/subtopics", {method:"POST",body:json(data)}),
  createActivity: (data: Partial<Activity>) => request<Activity>("curriculum/activities", {method:"POST",body:json(data)}),
  update: <T>(resource: string,id:UUID,data:Partial<T>) => request<T>(`curriculum/${resource}/${id}`,{method:"PATCH",body:json(data)}),
  remove: (resource:string,id:UUID) => request<void>(`curriculum/${resource}/${id}`,{method:"DELETE"}),
  saveContent: (activity: UUID, record: ContentRecord | null, content_type:string, content:Record<string,unknown>) => record ? request<ContentRecord>(`curriculum/activity-content/${record.id}`,{method:"PATCH",body:json({content_type,content})}) : request<ContentRecord>("curriculum/activity-content",{method:"POST",body:json({activity,content_type,content})}),
  saveExperiment: (activity: UUID, record: ExperimentRecord | null, data: Pick<ExperimentRecord,"experiment_type"|"instructions"|"configuration"|"external_url">) => record ? request<ExperimentRecord>(`curriculum/experiments/${record.id}`,{method:"PATCH",body:json(data)}) : request<ExperimentRecord>("curriculum/experiments",{method:"POST",body:json({activity,...data})}),
  reorder: (path:string,ids:UUID[]) => request<void>(`curriculum/${path}`,{method:"POST",body:json({ids})}),
  publish: (course:UUID,version:UUID) => request<Course>(`curriculum/courses/${course}/publish`,{method:"POST",body:json({version_id:version})}),
};
