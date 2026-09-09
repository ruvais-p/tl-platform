import type { Activity, Chapter, Course, CourseVersion, Subtopic, User, UUID } from "@/lib/curriculum/types";

export type { Activity, Chapter, Course, CourseVersion, Subtopic, User, UUID };

export type ChatCitation = { chunk_id: string; excerpt: string };
export type CourseChatResponse = {
  session_id: UUID;
  reply: string;
  grounded: boolean;
  citations: ChatCitation[];
};

export type ActivityProgress = {
  id: UUID;
  activity: UUID;
  status: string;
  progress_percentage: string | number;
  time_spent_seconds: number;
  started_at: string | null;
  last_accessed_at: string | null;
  attempt_count: number;
  metadata: Record<string, unknown>;
  extra: Record<string, unknown>;
  completed_at: string | null;
  updated_at: string;
};

export type CourseProgress = {
  id: UUID;
  enrollment: UUID;
  percent_complete: string | number;
  progress_percentage: string | number;
  status: string;
  completed_chapters: number;
  total_chapters: number;
  average_score: string | number;
  started_at: string | null;
  completed_at: string | null;
  last_accessed_at: string | null;
  last_activity_at: string | null;
};

export type Video = {
  id: UUID;
  activity: UUID;
  media_asset: UUID;
  thumbnail: UUID | null;
  title: string;
  description: string;
  duration_seconds: number;
  transcript: string;
  captions: unknown[];
  completion_percentage: number;
};

export type MediaAsset = {
  id: UUID;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  cdn_url: string;
  public_url: string;
  duration_seconds: number | null;
  status: string;
};

export type Gamification = {
  total_points: number;
  events: Array<{ id: UUID; reason: string; points: number; created_at: string }>;
  badges: Array<{ id: UUID; code: string; label: string; created_at: string }>;
};

export type CareerOpportunity = {
  id: UUID;
  title: string;
  kind: string;
  summary: string;
  url: string;
};

export type QuestionOption = {
  id: UUID;
  option_text: string;
  display_order: number;
};

export type StudentQuestion = {
  id: UUID;
  question_type: "MCQ" | "MULTI_SELECT" | "TRUE_FALSE" | "NUMERIC" | "SHORT_TEXT" | "LONG_TEXT" | "MATH_EXPRESSION";
  question_text: string;
  difficulty: string;
  marks: string | number;
  options: QuestionOption[];
};

export type LearningCheckQuestion = {
  id: UUID;
  question: UUID;
  question_detail: StudentQuestion;
  display_order: number;
  marks: string | number;
  is_required: boolean;
};

export type LearningCheck = {
  id: UUID;
  chapter: UUID;
  title: string;
  instructions: string;
  passing_score: string | number;
  max_attempts: number;
  time_limit_minutes: number | null;
  randomize_questions: boolean;
  status: string;
  questions: LearningCheckQuestion[];
};

export type AssessmentAttempt = {
  id: UUID;
  learning_check: UUID;
  attempt_number: number;
  score: string | number | null;
  max_score: string | number;
  percentage: string | number | null;
  status: string;
  passed: boolean | null;
  started_at: string;
  submitted_at: string | null;
  time_spent_seconds: number;
};
