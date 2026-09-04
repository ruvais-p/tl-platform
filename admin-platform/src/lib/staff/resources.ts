export type FieldOption = { label: string; value: string };

export type RelationDefinition = {
  endpoint: string;
  labelKeys: string[];
};

export type StaffFieldDefinition = {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "boolean"
    | "json"
    | "select"
    | "relation"
    | "datetime"
    | "file";
  required?: boolean;
  createOnly?: boolean;
  nullable?: boolean;
  defaultValue?: unknown;
  help?: string;
  options?: FieldOption[];
  relation?: RelationDefinition;
};

export type StaffResourceDefinition = {
  key: string;
  section:
    | "curriculum"
    | "content"
    | "media"
    | "learners"
    | "assessments"
    | "operations";
  title: string;
  singular: string;
  description: string;
  endpoint: string;
  viewPermission: string;
  addPermission?: string;
  changePermission?: string;
  fields: StaffFieldDefinition[];
  columns: Array<{ key: string; label: string }>;
};

export const publishStatuses: FieldOption[] = [
  { label: "Draft", value: "DRAFT" },
  { label: "In review", value: "IN_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Archived", value: "ARCHIVED" },
];

const activeStatuses: FieldOption[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Archived", value: "ARCHIVED" },
];

const enrollmentStatuses: FieldOption[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const assignmentStatuses: FieldOption[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const mediaStatuses: FieldOption[] = [
  { label: "Uploading", value: "UPLOADING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Ready", value: "READY" },
  { label: "Failed", value: "FAILED" },
  { label: "Archived", value: "ARCHIVED" },
];

const activity = { endpoint: "activities", labelKeys: ["title"] };
const mediaAsset = { endpoint: "media-assets", labelKeys: ["file_name"] };
const programs = { endpoint: "programs", labelKeys: ["name", "code"] };
const practiceSet = { endpoint: "practice-sets", labelKeys: ["title"] };
const users = { endpoint: "auth/users", labelKeys: ["display_name", "email"] };
const students = { endpoint: "students", labelKeys: ["display_name", "email"] };
const courses = { endpoint: "courses", labelKeys: ["name", "code"] };
const versions = {
  endpoint: "course-versions",
  labelKeys: ["name", "version_number"],
};
const groups = { endpoint: "student-groups", labelKeys: ["name", "code"] };
const questions = { endpoint: "questions", labelKeys: ["question_text"] };
const chapters = { endpoint: "chapters", labelKeys: ["title"] };
const subtopics = { endpoint: "subtopics", labelKeys: ["title"] };
const checks = { endpoint: "learning-checks", labelKeys: ["title"] };
const caseStudies = { endpoint: "case-studies", labelKeys: ["title"] };

export const staffResources: Record<string, StaffResourceDefinition> = {
  programs: {
    key: "programs",
    section: "curriculum",
    title: "Programs",
    singular: "program",
    description: "Create and maintain the top-level curriculum catalog.",
    endpoint: "programs",
    viewPermission: "curriculum.view_program",
    addPermission: "curriculum.add_program",
    changePermission: "curriculum.change_program",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Unique code", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "grade", label: "Grade", type: "text" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: publishStatuses,
        defaultValue: "DRAFT",
        required: true,
      },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "grade", label: "Grade" },
      { key: "status", label: "Status" },
    ],
  },
  courses: {
    key: "courses",
    section: "curriculum",
    title: "Course records",
    singular: "course",
    description:
      "Maintain course metadata, catalog placement, thumbnails, and lifecycle status.",
    endpoint: "courses",
    viewPermission: "curriculum.view_course",
    addPermission: "curriculum.add_course",
    changePermission: "curriculum.change_course",
    fields: [
      {
        key: "program",
        label: "Program",
        type: "relation",
        relation: programs,
        required: true,
      },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Unique code", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "thumbnail",
        label: "Thumbnail asset",
        type: "relation",
        relation: mediaAsset,
        nullable: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: publishStatuses,
        defaultValue: "DRAFT",
        required: true,
      },
      {
        key: "display_order",
        label: "Display order",
        type: "number",
        defaultValue: 0,
        required: true,
      },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "program", label: "Program" },
      { key: "status", label: "Status" },
    ],
  },
  "activity-content": {
    key: "activity-content",
    section: "content",
    title: "Content blocks",
    singular: "content block",
    description:
      "Maintain flexible lesson content attached to learning activities.",
    endpoint: "activity-content",
    viewPermission: "content.view_activitycontent",
    addPermission: "content.add_activitycontent",
    changePermission: "content.change_activitycontent",
    fields: [
      {
        key: "activity",
        label: "Activity",
        type: "relation",
        relation: activity,
        required: true,
      },
      {
        key: "content_type",
        label: "Content type",
        type: "text",
        defaultValue: "application/json",
        required: true,
      },
      {
        key: "content",
        label: "Content JSON",
        type: "json",
        defaultValue: {},
        required: true,
        help: "Use a valid JSON object understood by the learner renderer.",
      },
    ],
    columns: [
      { key: "activity", label: "Activity" },
      { key: "content_type", label: "Content type" },
      { key: "updated_at", label: "Updated" },
    ],
  },
  videos: {
    key: "videos",
    section: "content",
    title: "Videos",
    singular: "video",
    description:
      "Attach uploaded media, transcripts, and completion rules to activities.",
    endpoint: "videos",
    viewPermission: "content.view_video",
    addPermission: "content.add_video",
    changePermission: "content.change_video",
    fields: [
      {
        key: "activity",
        label: "Activity",
        type: "relation",
        relation: activity,
        required: true,
      },
      {
        key: "media_asset",
        label: "Video asset",
        type: "relation",
        relation: mediaAsset,
        required: true,
      },
      {
        key: "thumbnail",
        label: "Thumbnail asset",
        type: "relation",
        relation: mediaAsset,
        nullable: true,
      },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "duration_seconds",
        label: "Duration in seconds",
        type: "number",
        required: true,
      },
      { key: "transcript", label: "Transcript", type: "textarea" },
      {
        key: "captions",
        label: "Captions JSON",
        type: "json",
        defaultValue: [],
      },
      {
        key: "completion_percentage",
        label: "Completion percentage",
        type: "number",
        defaultValue: 90,
        required: true,
      },
    ],
    columns: [
      { key: "title", label: "Title" },
      { key: "activity", label: "Activity" },
      { key: "duration_seconds", label: "Seconds" },
      { key: "completion_percentage", label: "Completion" },
    ],
  },
  experiments: {
    key: "experiments",
    section: "content",
    title: "Experiments",
    singular: "experiment",
    description: "Configure data-driven interactive learning experiences.",
    endpoint: "experiments",
    viewPermission: "content.view_experiment",
    addPermission: "content.add_experiment",
    changePermission: "content.change_experiment",
    fields: [
      {
        key: "activity",
        label: "Activity",
        type: "relation",
        relation: activity,
        required: true,
      },
      {
        key: "experiment_type",
        label: "Experiment type",
        type: "select",
        required: true,
        options: [
          { label: "HTML interactive", value: "HTML_INTERACTIVE" },
          { label: "Embedded", value: "EMBEDDED" },
          { label: "Simulation", value: "SIMULATION" },
          { label: "Question based", value: "QUESTION_BASED" },
        ],
      },
      {
        key: "instructions",
        label: "Instructions",
        type: "textarea",
        required: true,
      },
      {
        key: "configuration",
        label: "Configuration JSON",
        type: "json",
        defaultValue: {},
        required: true,
      },
      {
        key: "external_url",
        label: "External URL",
        type: "text",
        nullable: true,
      },
    ],
    columns: [
      { key: "activity", label: "Activity" },
      { key: "experiment_type", label: "Type" },
      { key: "updated_at", label: "Updated" },
    ],
  },
  "practice-sets": {
    key: "practice-sets",
    section: "content",
    title: "Practice sets",
    singular: "practice set",
    description: "Create scored practice sequences for activities.",
    endpoint: "practice-sets",
    viewPermission: "content.view_practiceset",
    addPermission: "content.add_practiceset",
    changePermission: "content.change_practiceset",
    fields: [
      {
        key: "activity",
        label: "Activity",
        type: "relation",
        relation: activity,
        required: true,
      },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "passing_score",
        label: "Passing score",
        type: "number",
        defaultValue: 70,
        required: true,
      },
      {
        key: "display_order",
        label: "Display order",
        type: "number",
        defaultValue: 0,
        required: true,
      },
    ],
    columns: [
      { key: "title", label: "Title" },
      { key: "activity", label: "Activity" },
      { key: "passing_score", label: "Passing score" },
      { key: "display_order", label: "Order" },
    ],
  },
  "practice-items": {
    key: "practice-items",
    section: "content",
    title: "Practice items",
    singular: "practice item",
    description:
      "Assemble videos, questions, and free-practice steps into a sequence.",
    endpoint: "practice-items",
    viewPermission: "content.view_practiceitem",
    addPermission: "content.add_practiceitem",
    changePermission: "content.change_practiceitem",
    fields: [
      {
        key: "practice_set",
        label: "Practice set",
        type: "relation",
        relation: practiceSet,
        required: true,
      },
      {
        key: "item_type",
        label: "Item type",
        type: "select",
        required: true,
        options: [
          { label: "Video", value: "VIDEO" },
          { label: "Question", value: "QUESTION" },
          { label: "Practice", value: "PRACTICE" },
        ],
      },
      {
        key: "video",
        label: "Video",
        type: "relation",
        relation: { endpoint: "videos", labelKeys: ["title"] },
        nullable: true,
      },
      {
        key: "question_reference",
        label: "Question UUID",
        type: "text",
        nullable: true,
      },
      {
        key: "display_order",
        label: "Display order",
        type: "number",
        defaultValue: 0,
        required: true,
      },
      {
        key: "is_required",
        label: "Required",
        type: "boolean",
        defaultValue: true,
      },
    ],
    columns: [
      { key: "practice_set", label: "Practice set" },
      { key: "item_type", label: "Type" },
      { key: "display_order", label: "Order" },
      { key: "is_required", label: "Required" },
    ],
  },
  "media-assets": {
    key: "media-assets",
    section: "media",
    title: "Media assets",
    singular: "media asset",
    description:
      "Upload and maintain videos, images, documents, and other learning files.",
    endpoint: "media-assets",
    viewPermission: "media_library.view_mediaasset",
    addPermission: "media_library.add_mediaasset",
    changePermission: "media_library.change_mediaasset",
    fields: [
      {
        key: "upload",
        label: "Local file",
        type: "file",
        createOnly: true,
        help: "Choose a file to let Django populate its metadata and storage path.",
      },
      { key: "file_name", label: "File name", type: "text" },
      { key: "file_type", label: "File type", type: "text" },
      { key: "mime_type", label: "MIME type", type: "text" },
      { key: "file_size", label: "File size", type: "number", defaultValue: 0 },
      { key: "storage_path", label: "Storage path", type: "text" },
      { key: "cdn_url", label: "CDN URL", type: "text" },
      {
        key: "duration_seconds",
        label: "Duration in seconds",
        type: "number",
        nullable: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: mediaStatuses,
        defaultValue: "UPLOADING",
      },
    ],
    columns: [
      { key: "file_name", label: "File" },
      { key: "file_type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Uploaded" },
    ],
  },
  students: {
    key: "students",
    section: "learners",
    title: "Students",
    singular: "student",
    description:
      "Review student accounts available for cohorts and enrollment.",
    endpoint: "students",
    viewPermission: "accounts.view_user",
    fields: [],
    columns: [
      { key: "display_name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "groups", label: "Roles" },
      { key: "is_active", label: "Active" },
    ],
  },
  "student-groups": {
    key: "student-groups",
    section: "learners",
    title: "Student groups",
    singular: "student group",
    description: "Organize cohorts and assign their teacher.",
    endpoint: "student-groups",
    viewPermission: "students.view_studentgroup",
    addPermission: "students.add_studentgroup",
    changePermission: "students.change_studentgroup",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Unique code", type: "text", required: true },
      { key: "grade", label: "Grade", type: "text" },
      {
        key: "academic_year",
        label: "Academic year",
        type: "number",
        required: true,
      },
      {
        key: "teacher",
        label: "Teacher",
        type: "relation",
        relation: users,
        nullable: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: activeStatuses,
        defaultValue: "ACTIVE",
        required: true,
      },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "academic_year", label: "Year" },
      { key: "status", label: "Status" },
    ],
  },
  "student-group-members": {
    key: "student-group-members",
    section: "learners",
    title: "Group memberships",
    singular: "group membership",
    description: "Add students to teaching cohorts.",
    endpoint: "student-group-members",
    viewPermission: "students.view_studentgroupmember",
    addPermission: "students.add_studentgroupmember",
    changePermission: "students.change_studentgroupmember",
    fields: [
      {
        key: "student_group",
        label: "Student group",
        type: "relation",
        relation: groups,
        required: true,
      },
      {
        key: "student",
        label: "Student",
        type: "relation",
        relation: students,
        required: true,
      },
    ],
    columns: [
      { key: "student_group", label: "Group" },
      { key: "student", label: "Student" },
      { key: "joined_at", label: "Joined" },
    ],
  },
  enrollments: {
    key: "enrollments",
    section: "learners",
    title: "Enrollments",
    singular: "enrollment",
    description: "Manage each student’s access to a specific course version.",
    endpoint: "enrollments",
    viewPermission: "students.view_enrollment",
    addPermission: "students.add_enrollment",
    changePermission: "students.change_enrollment",
    fields: [
      {
        key: "student",
        label: "Student",
        type: "relation",
        relation: students,
        required: true,
      },
      {
        key: "course",
        label: "Course",
        type: "relation",
        relation: courses,
        required: true,
      },
      {
        key: "course_version",
        label: "Course version",
        type: "relation",
        relation: versions,
        required: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: enrollmentStatuses,
        defaultValue: "ACTIVE",
        required: true,
      },
      {
        key: "expires_at",
        label: "Expires at",
        type: "datetime",
        nullable: true,
      },
    ],
    columns: [
      { key: "student", label: "Student" },
      { key: "course", label: "Course" },
      { key: "course_version", label: "Version" },
      { key: "status", label: "Status" },
    ],
  },
  "course-assignments": {
    key: "course-assignments",
    section: "learners",
    title: "Course assignments",
    singular: "course assignment",
    description:
      "Assign a version to either a cohort or an individual student.",
    endpoint: "course-assignments",
    viewPermission: "students.view_courseassignment",
    addPermission: "students.add_courseassignment",
    changePermission: "students.change_courseassignment",
    fields: [
      {
        key: "course",
        label: "Course",
        type: "relation",
        relation: courses,
        required: true,
      },
      {
        key: "course_version",
        label: "Course version",
        type: "relation",
        relation: versions,
        required: true,
      },
      {
        key: "student_group",
        label: "Student group",
        type: "relation",
        relation: groups,
        nullable: true,
        help: "Choose either a group or a student, not both.",
      },
      {
        key: "student",
        label: "Individual student",
        type: "relation",
        relation: students,
        nullable: true,
      },
      { key: "due_date", label: "Due date", type: "datetime", nullable: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: assignmentStatuses,
        defaultValue: "ACTIVE",
        required: true,
      },
    ],
    columns: [
      { key: "course", label: "Course" },
      { key: "student_group", label: "Group" },
      { key: "student", label: "Student" },
      { key: "status", label: "Status" },
    ],
  },
  "external-user-mappings": {
    key: "external-user-mappings",
    section: "learners",
    title: "External mappings",
    singular: "external mapping",
    description:
      "Connect Tella accounts to Moodle, Canvas, or mobile identities.",
    endpoint: "external-user-mappings",
    viewPermission: "students.view_externalusermapping",
    addPermission: "students.add_externalusermapping",
    changePermission: "students.change_externalusermapping",
    fields: [
      {
        key: "user",
        label: "User",
        type: "relation",
        relation: users,
        required: true,
      },
      {
        key: "provider",
        label: "Provider",
        type: "select",
        options: [
          { label: "Moodle", value: "MOODLE" },
          { label: "Canvas", value: "CANVAS" },
          { label: "Mobile app", value: "MOBILE_APP" },
        ],
        required: true,
      },
      {
        key: "external_user_id",
        label: "External user ID",
        type: "text",
        required: true,
      },
      {
        key: "metadata",
        label: "Metadata JSON",
        type: "json",
        defaultValue: {},
      },
    ],
    columns: [
      { key: "user", label: "User" },
      { key: "provider", label: "Provider" },
      { key: "external_user_id", label: "External ID" },
    ],
  },
  questions: {
    key: "questions",
    section: "assessments",
    title: "Question bank",
    singular: "question",
    description: "Author reusable questions and canonical answer metadata.",
    endpoint: "questions",
    viewPermission: "assessments.view_question",
    addPermission: "assessments.add_question",
    changePermission: "assessments.change_question",
    fields: [
      {
        key: "question_type",
        label: "Question type",
        type: "select",
        required: true,
        options: [
          { label: "Multiple choice", value: "MCQ" },
          { label: "Multiple select", value: "MULTI_SELECT" },
          { label: "True / false", value: "TRUE_FALSE" },
          { label: "Numeric", value: "NUMERIC" },
          { label: "Short text", value: "SHORT_TEXT" },
          { label: "Long text", value: "LONG_TEXT" },
          { label: "Math expression", value: "MATH_EXPRESSION" },
        ],
      },
      {
        key: "question_text",
        label: "Question",
        type: "textarea",
        required: true,
      },
      { key: "explanation", label: "Explanation", type: "textarea" },
      {
        key: "difficulty",
        label: "Difficulty",
        type: "select",
        options: [
          { label: "Easy", value: "EASY" },
          { label: "Medium", value: "MEDIUM" },
          { label: "Hard", value: "HARD" },
        ],
        defaultValue: "MEDIUM",
        required: true,
      },
      {
        key: "marks",
        label: "Marks",
        type: "number",
        defaultValue: 1,
        required: true,
      },
      { key: "subject", label: "Subject", type: "text" },
      { key: "grade", label: "Grade", type: "text" },
      {
        key: "chapter",
        label: "Chapter",
        type: "relation",
        relation: chapters,
        nullable: true,
      },
      {
        key: "subtopic",
        label: "Subtopic",
        type: "relation",
        relation: subtopics,
        nullable: true,
      },
      {
        key: "metadata",
        label: "Answer metadata JSON",
        type: "json",
        defaultValue: {},
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: publishStatuses,
        defaultValue: "DRAFT",
        required: true,
      },
    ],
    columns: [
      { key: "question_text", label: "Question" },
      { key: "question_type", label: "Type" },
      { key: "difficulty", label: "Difficulty" },
      { key: "status", label: "Status" },
    ],
  },
  "question-options": {
    key: "question-options",
    section: "assessments",
    title: "Question options",
    singular: "question option",
    description: "Define ordered choices and mark canonical correct answers.",
    endpoint: "question-options",
    viewPermission: "assessments.view_questionoption",
    addPermission: "assessments.add_questionoption",
    changePermission: "assessments.change_questionoption",
    fields: [
      {
        key: "question",
        label: "Question",
        type: "relation",
        relation: questions,
        required: true,
      },
      {
        key: "option_text",
        label: "Option text",
        type: "textarea",
        required: true,
      },
      {
        key: "is_correct",
        label: "Correct answer",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "display_order",
        label: "Display order",
        type: "number",
        defaultValue: 0,
        required: true,
      },
      { key: "explanation", label: "Explanation", type: "textarea" },
    ],
    columns: [
      { key: "question", label: "Question" },
      { key: "option_text", label: "Option" },
      { key: "is_correct", label: "Correct" },
      { key: "display_order", label: "Order" },
    ],
  },
  "case-studies": {
    key: "case-studies",
    section: "assessments",
    title: "Case studies",
    singular: "case study",
    description: "Build chapter-level applied assessment scenarios.",
    endpoint: "case-studies",
    viewPermission: "assessments.view_casestudy",
    addPermission: "assessments.add_casestudy",
    changePermission: "assessments.change_casestudy",
    fields: [
      {
        key: "chapter",
        label: "Chapter",
        type: "relation",
        relation: chapters,
        required: true,
      },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "introduction", label: "Introduction", type: "textarea" },
      { key: "content", label: "Content JSON", type: "json", defaultValue: {} },
      {
        key: "estimated_minutes",
        label: "Estimated minutes",
        type: "number",
        defaultValue: 0,
      },
      {
        key: "passing_score",
        label: "Passing score",
        type: "number",
        defaultValue: 70,
        required: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: publishStatuses,
        defaultValue: "DRAFT",
        required: true,
      },
    ],
    columns: [
      { key: "title", label: "Title" },
      { key: "chapter", label: "Chapter" },
      { key: "passing_score", label: "Passing score" },
      { key: "status", label: "Status" },
    ],
  },
  "case-study-questions": {
    key: "case-study-questions",
    section: "assessments",
    title: "Case-study questions",
    singular: "case-study question",
    description: "Attach reusable questions to case studies.",
    endpoint: "case-study-questions",
    viewPermission: "assessments.view_casestudyquestion",
    addPermission: "assessments.add_casestudyquestion",
    changePermission: "assessments.change_casestudyquestion",
    fields: [
      {
        key: "case_study",
        label: "Case study",
        type: "relation",
        relation: caseStudies,
        required: true,
      },
      {
        key: "question",
        label: "Question",
        type: "relation",
        relation: questions,
        required: true,
      },
      {
        key: "display_order",
        label: "Display order",
        type: "number",
        defaultValue: 0,
        required: true,
      },
      {
        key: "marks",
        label: "Marks",
        type: "number",
        defaultValue: 1,
        required: true,
      },
      {
        key: "is_required",
        label: "Required",
        type: "boolean",
        defaultValue: true,
      },
    ],
    columns: [
      { key: "case_study", label: "Case study" },
      { key: "question", label: "Question" },
      { key: "display_order", label: "Order" },
      { key: "marks", label: "Marks" },
    ],
  },
  "learning-checks": {
    key: "learning-checks",
    section: "assessments",
    title: "Learning checks",
    singular: "learning check",
    description:
      "Configure chapter checks, pass thresholds, and attempt limits.",
    endpoint: "learning-checks",
    viewPermission: "assessments.view_learningcheck",
    addPermission: "assessments.add_learningcheck",
    changePermission: "assessments.change_learningcheck",
    fields: [
      {
        key: "chapter",
        label: "Chapter",
        type: "relation",
        relation: chapters,
        required: true,
      },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "instructions", label: "Instructions", type: "textarea" },
      {
        key: "passing_score",
        label: "Passing score",
        type: "number",
        defaultValue: 70,
        required: true,
      },
      {
        key: "max_attempts",
        label: "Maximum attempts",
        type: "number",
        defaultValue: 3,
        required: true,
      },
      {
        key: "time_limit_minutes",
        label: "Time limit in minutes",
        type: "number",
        nullable: true,
      },
      {
        key: "randomize_questions",
        label: "Randomize questions",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: publishStatuses,
        defaultValue: "DRAFT",
        required: true,
      },
    ],
    columns: [
      { key: "title", label: "Title" },
      { key: "chapter", label: "Chapter" },
      { key: "passing_score", label: "Passing score" },
      { key: "status", label: "Status" },
    ],
  },
  "learning-check-questions": {
    key: "learning-check-questions",
    section: "assessments",
    title: "Learning-check questions",
    singular: "learning-check question",
    description: "Attach ordered questions to learning checks.",
    endpoint: "learning-check-questions",
    viewPermission: "assessments.view_learningcheckquestion",
    addPermission: "assessments.add_learningcheckquestion",
    changePermission: "assessments.change_learningcheckquestion",
    fields: [
      {
        key: "learning_check",
        label: "Learning check",
        type: "relation",
        relation: checks,
        required: true,
      },
      {
        key: "question",
        label: "Question",
        type: "relation",
        relation: questions,
        required: true,
      },
      {
        key: "display_order",
        label: "Display order",
        type: "number",
        defaultValue: 0,
        required: true,
      },
      {
        key: "marks",
        label: "Marks",
        type: "number",
        defaultValue: 1,
        required: true,
      },
      {
        key: "is_required",
        label: "Required",
        type: "boolean",
        defaultValue: true,
      },
    ],
    columns: [
      { key: "learning_check", label: "Learning check" },
      { key: "question", label: "Question" },
      { key: "display_order", label: "Order" },
      { key: "marks", label: "Marks" },
    ],
  },
  "activity-progress-records": {
    key: "activity-progress-records",
    section: "operations",
    title: "Activity progress",
    singular: "activity progress record",
    description:
      "Review learner completion, attempts, and time spent across activities.",
    endpoint: "activity-progress-records",
    viewPermission: "progress.view_activityprogress",
    fields: [],
    columns: [
      { key: "student_email", label: "Student" },
      { key: "course_name", label: "Course" },
      { key: "activity_title", label: "Activity" },
      { key: "progress_percentage", label: "Progress %" },
      { key: "status", label: "Status" },
      { key: "updated_at", label: "Updated" },
    ],
  },
  "assessment-attempts": {
    key: "assessment-attempts",
    section: "operations",
    title: "Assessment attempts",
    singular: "assessment attempt",
    description:
      "Inspect submitted learning-check attempts and their grading outcomes.",
    endpoint: "assessment-attempts",
    viewPermission: "assessments.view_assessmentattempt",
    fields: [],
    columns: [
      { key: "student_email", label: "Student" },
      { key: "learning_check_title", label: "Learning check" },
      { key: "attempt_number", label: "Attempt" },
      { key: "percentage", label: "Score %" },
      { key: "passed", label: "Passed" },
      { key: "status", label: "Status" },
      { key: "started_at", label: "Started" },
    ],
  },
  "assessment-answers": {
    key: "assessment-answers",
    section: "operations",
    title: "Assessment answers",
    singular: "assessment answer",
    description:
      "Review the answers and awarded marks behind assessment results.",
    endpoint: "assessment-answers",
    viewPermission: "assessments.view_assessmentanswer",
    fields: [],
    columns: [
      { key: "student_email", label: "Student" },
      { key: "question_text", label: "Question" },
      { key: "answer", label: "Answer" },
      { key: "marks_awarded", label: "Marks" },
      { key: "is_correct", label: "Correct" },
      { key: "answered_at", label: "Answered" },
    ],
  },
  "point-events": {
    key: "point-events",
    section: "operations",
    title: "Point events",
    singular: "point event",
    description: "Audit automatically awarded gamification points.",
    endpoint: "point-events",
    viewPermission: "progress.view_pointevent",
    fields: [],
    columns: [
      { key: "user_email", label: "Learner" },
      { key: "activity_title", label: "Activity" },
      { key: "reason", label: "Reason" },
      { key: "points", label: "Points" },
      { key: "created_at", label: "Awarded" },
    ],
  },
  "badge-awards": {
    key: "badge-awards",
    section: "operations",
    title: "Badge awards",
    singular: "badge award",
    description: "Audit badges awarded by tracked learner interactions.",
    endpoint: "badge-awards",
    viewPermission: "progress.view_badgeaward",
    fields: [],
    columns: [
      { key: "user_email", label: "Learner" },
      { key: "activity_title", label: "Activity" },
      { key: "label", label: "Badge" },
      { key: "created_at", label: "Awarded" },
    ],
  },
  "career-opportunities": {
    key: "career-opportunities",
    section: "operations",
    title: "Career opportunities",
    singular: "career opportunity",
    description:
      "Create and publish the opportunities shown in the learner career feed.",
    endpoint: "career-opportunities",
    viewPermission: "progress.view_careeropportunity",
    addPermission: "progress.add_careeropportunity",
    changePermission: "progress.change_careeropportunity",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      {
        key: "kind",
        label: "Type",
        type: "text",
        defaultValue: "internship",
        required: true,
      },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "url", label: "URL", type: "text" },
      {
        key: "is_published",
        label: "Published",
        type: "boolean",
        defaultValue: false,
      },
    ],
    columns: [
      { key: "title", label: "Title" },
      { key: "kind", label: "Type" },
      { key: "is_published", label: "Published" },
      { key: "updated_at", label: "Updated" },
    ],
  },
  "legacy-assessment-attempts": {
    key: "legacy-assessment-attempts",
    section: "operations",
    title: "Legacy activity attempts",
    singular: "legacy activity attempt",
    description:
      "Review compatibility records created by earlier activity assessments.",
    endpoint: "legacy-assessment-attempts",
    viewPermission: "progress.view_assessmentattempt",
    fields: [],
    columns: [
      { key: "user_email", label: "Learner" },
      { key: "activity_title", label: "Activity" },
      { key: "score", label: "Score" },
      { key: "started_at", label: "Started" },
      { key: "submitted_at", label: "Submitted" },
    ],
  },
  "workshop-configs": {
    key: "workshop-configs",
    section: "operations",
    title: "Legacy workshop configurations",
    singular: "workshop configuration",
    description:
      "Maintain compatibility settings for the original optimization workshop.",
    endpoint: "workshop-configs",
    viewPermission: "workshops.view_workshopconfig",
    addPermission: "workshops.add_workshopconfig",
    changePermission: "workshops.change_workshopconfig",
    fields: [
      {
        key: "activity",
        label: "Activity",
        type: "relation",
        relation: activity,
        required: true,
      },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "price1", label: "Product 1 price", type: "number", required: true },
      { key: "price_drop1", label: "Product 1 price drop", type: "number", required: true },
      { key: "cost1", label: "Product 1 cost", type: "number", required: true },
      { key: "price2", label: "Product 2 price", type: "number", required: true },
      { key: "price_drop2", label: "Product 2 price drop", type: "number", required: true },
      { key: "cost2", label: "Product 2 cost", type: "number", required: true },
      { key: "congestion", label: "Congestion", type: "number", required: true },
      { key: "fixed_cost", label: "Fixed cost", type: "number", required: true },
      { key: "current_x", label: "Current product 1 units", type: "number", defaultValue: 0 },
      { key: "current_y", label: "Current product 2 units", type: "number", defaultValue: 0 },
      { key: "product1_label", label: "Product 1 label", type: "text", defaultValue: "Puffs" },
      { key: "product2_label", label: "Product 2 label", type: "text", defaultValue: "Tea" },
      { key: "unit1", label: "Product 1 unit", type: "text", defaultValue: "puffs per day" },
      { key: "unit2", label: "Product 2 unit", type: "text", defaultValue: "teas per day" },
      { key: "currency", label: "Currency", type: "text", defaultValue: "₹" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "activity_title", label: "Activity" },
      { key: "product1_label", label: "Product 1" },
      { key: "product2_label", label: "Product 2" },
      { key: "updated_at", label: "Updated" },
    ],
  },
  "staff-workshop-models": {
    key: "staff-workshop-models",
    section: "operations",
    title: "Saved workshop models",
    singular: "saved workshop model",
    description:
      "Review learner and shared models saved by the legacy workshop runner.",
    endpoint: "staff-workshop-models",
    viewPermission: "workshops.view_workshopmodel",
    fields: [],
    columns: [
      { key: "name", label: "Name" },
      { key: "user_email", label: "Owner" },
      { key: "activity_title", label: "Activity" },
      { key: "config", label: "Configuration" },
      { key: "updated_at", label: "Updated" },
    ],
  },
};

export const resourcesBySection = (
  section: StaffResourceDefinition["section"],
) =>
  Object.values(staffResources).filter(
    (resource) => resource.section === section,
  );
