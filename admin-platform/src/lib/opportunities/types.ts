import type { UUID } from "@/lib/curriculum/types";

export type EmploymentType = "INTERNSHIP" | "FULL_TIME" | "PART_TIME" | "CONTRACT" | "APPRENTICESHIP" | "PROJECT";
export type WorkplaceMode = "REMOTE" | "HYBRID" | "IN_OFFICE";
export type OpportunityLifecycle = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type ApplicationMode = "INTERNAL" | "EXTERNAL";
export type CompensationDisclosure = "NOT_DISCLOSED" | "PAID" | "UNPAID";
export type PayPeriod = "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" | "PROJECT";
export type ApplicationStatus = "SUBMITTED" | "UNDER_REVIEW" | "SHORTLISTED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export type EligibilityCondition =
  | { fact: "STUDENT_GROUP"; operator: "IN"; values: UUID[] }
  | { fact: "GROUP_GRADE"; operator: "IN"; values: string[] }
  | { fact: "COURSE_ENROLLMENT"; operator: "IN"; course_id: UUID; values: string[] }
  | { fact: "COURSE_COMPLETION"; operator: "EQ"; course_id: UUID; value: boolean }
  | { fact: "COURSE_PROGRESS"; operator: "GTE"; course_id: UUID; value: number }
  | { fact: "LEARNING_CHECK_SCORE"; operator: "GTE"; learning_check_id: UUID; value: number };

export type EligibilityRules = { version: 1; match: "ALL" | "ANY"; conditions: EligibilityCondition[] };
export type EligibilityResult = { eligible: boolean; reasons: string[] };

export type LearnerOpportunity = {
  id: UUID;
  title: string;
  company_name: string;
  company_website: string;
  company_logo_url: string;
  summary: string;
  description_markdown: string;
  employment_type: EmploymentType;
  employment_type_label: string;
  workplace_mode: WorkplaceMode;
  workplace_mode_label: string;
  physical_location: string;
  remote_region: string;
  openings: number | null;
  compensation_disclosure: CompensationDisclosure;
  compensation_currency: string;
  compensation_min: string | null;
  compensation_max: string | null;
  compensation_pay_period: PayPeriod | "";
  start_date: string | null;
  duration: string;
  application_deadline: string | null;
  application_mode: ApplicationMode;
  application_url: string;
  cover_note_required: boolean;
  resume_required: boolean;
  is_featured: boolean;
  is_open: boolean;
  eligibility: EligibilityResult;
};

export type StaffOpportunity = Omit<LearnerOpportunity, "company_logo_url" | "eligibility"> & {
  company_logo: UUID | null;
  lifecycle_status: OpportunityLifecycle;
  audience_scope: "ALL_LEARNERS" | "SELECTED_GROUPS";
  audience_groups: UUID[];
  eligibility_rules: EligibilityRules;
  created_at: string;
  updated_at: string;
};

export type OpportunityInput = Omit<StaffOpportunity, "id" | "is_open" | "created_at" | "updated_at" | "employment_type_label" | "workplace_mode_label" | "lifecycle_status">;

export type LearnerApplication = {
  id: UUID;
  opportunity_id: UUID;
  opportunity_title: string;
  company_name: string;
  submitted_at: string;
  updated_at: string;
  status: ApplicationStatus;
  status_label: string;
  can_withdraw: boolean;
  has_resume: boolean;
};

export type StaffApplication = LearnerApplication & {
  opportunity: UUID;
  applicant: UUID;
  applicant_name: string;
  applicant_email: string;
  contact_phone: string;
  cover_note: string;
  created_at: string;
  review_notes: string;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
};
