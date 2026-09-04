import type { UUID } from "@/lib/curriculum/types";

export type Person = {
  id: UUID;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
  is_active: boolean;
  date_joined: string;
  groups: string[];
  permissions: string[];
};

export type RoleOption = { value: string; label: string; protected: boolean };
export type PersonInput = Pick<Person, "email" | "first_name" | "last_name" | "is_active"> & {
  role_names: string[];
  password?: string;
};

export type ActivityAnalytics = { id: UUID; title: string; activity_type: string; is_required: boolean; estimated_minutes: number; status: string; progress_percentage: number; time_spent_seconds: number; attempt_count: number; started_at: string | null; last_accessed_at: string | null; completed_at: string | null };
export type SubtopicAnalytics = { id: UUID; title: string; status: string; progress_percentage: number; completed_activities: number; total_required_activities: number; activities: ActivityAnalytics[] };
export type AssessmentAnalytics = { id: UUID; title: string; attempt_number: number; status: string; score: number | null; max_score: number; percentage: number | null; passed: boolean | null; time_spent_seconds: number; started_at: string; submitted_at: string | null };
export type ChapterAnalytics = { id: UUID; title: string; chapter_number: number; status: string; progress_percentage: number; completed_subtopics: number; total_subtopics: number; learning_check_score: number | null; assessments: AssessmentAnalytics[]; subtopics: SubtopicAnalytics[] };
export type CourseAnalytics = { enrollment_id: UUID; course_id: UUID; course_name: string; program_name: string; version_name: string; enrollment_status: string; enrolled_at: string; started_at: string | null; completed_at: string | null; expires_at: string | null; status: string; progress_percentage: number; completed_chapters: number; total_chapters: number; average_score: number; last_activity_at: string | null; chapters: ChapterAnalytics[] };
export type StudentAnalytics = {
  student: Person;
  groups: { id: UUID; name: string; grade: string; academic_year: number; teacher: string | null; joined_at: string }[];
  summary: { assigned_courses: number; completed_courses: number; average_completion: number; average_score: number; time_spent_seconds: number; total_points: number; badges_earned: number; assessment_attempts: number };
  courses: CourseAnalytics[];
  assignments: { id: UUID; course_name: string; version_name: string; source: string; assigned_by: string; assigned_at: string; due_date: string | null; status: string }[];
  badges: { code: string; label: string; earned_at: string }[];
};
