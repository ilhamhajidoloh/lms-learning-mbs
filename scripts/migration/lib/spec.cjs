/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 4A: single source of truth for the PostgreSQL/Cockroach -> Oracle column mapping.
// build-manifest.cjs turns this into database/migration/migration-manifest.json (the file every other
// migration script reads). Target types/lengths mirror database/oracle/migrations/*.sql exactly.
// NOTE: Oracle VARCHAR2 lengths here are BYTE lengths (live check: NLS_LENGTH_SEMANTICS=BYTE, AL32UTF8).

const TGT = (key) => {
  if (key === "U36") return { type: "VARCHAR2", length: 36 };
  if (/^V\d+$/.test(key)) return { type: "VARCHAR2", length: Number(key.slice(1)) };
  if (key === "B") return { type: "NUMBER", precision: 1, scale: 0 };
  if (key === "INT") return { type: "NUMBER", precision: 10, scale: 0 };
  if (key === "NUM") return { type: "NUMBER", precision: 12, scale: 4 };
  if (key === "TS") return { type: "TIMESTAMP WITH TIME ZONE" };
  if (key === "DATE") return { type: "DATE" };
  if (key === "T5") return { type: "VARCHAR2", length: 5 };
  if (key === "CLOB") return { type: "CLOB" };
  if (key === "JSON") return { type: "CLOB", json: true };
  throw new Error(`unknown target key ${key}`);
};

/**
 * c(sourceName, expectedSourceType, targetKey, flags)
 * flags: to = Oracle column name (rename); nl = nullable; ec = EMPTY_CLOB policy (NOT NULL text);
 *        shape = expected JSON shape ('array' | 'object' | 'any')
 */
const c = (name, src, tgt, flags = {}) => ({ name, src, tgt, ...flags });

const TABLES = {
  users: {
    columns: [
      c("id", "uuid", "U36"), c("email", "text", "V320"), c("password_hash", "text", "V255"),
      c("username", "text", "V255"), c("display_name", "text", "V1000"), c("role", "text", "V20"),
      c("password_changed", "bool", "B"), c("created_at", "timestamptz", "TS"),
    ],
    pk: ["id"], fks: [], unique: [["email"], ["username"]],
    checks: [{ type: "enum", col: "role", values: ["admin", "teacher", "student"] }],
  },
  course_levels: {
    columns: [
      c("id", "uuid", "U36"), c("value", "text", "V255", { to: "level_value" }), c("label", "text", "V1000"),
      c("sort_order", "int", "INT"), c("created_at", "timestamptz", "TS"),
    ],
    pk: ["id"], fks: [], unique: [["value"]], checks: [],
  },
  courses: {
    columns: [
      c("id", "text", "V255"), c("title", "text", "V2000"), c("level", "text", "V255", { to: "course_level" }),
      c("level_label", "text", "V1000"), c("gradient_class", "text", "V255"), c("instructor_id", "uuid", "U36"),
      c("is_open", "bool", "B"), c("enroll_code", "text", "V255", { nl: true }), c("show_scores", "bool", "B"),
      c("sequential_lessons", "bool", "B"), c("quiz_review_mode", "text", "V30"),
      c("created_at", "timestamptz", "TS"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["id"], fks: [{ cols: ["instructor_id"], ref: "users", onDelete: "restrict" }], unique: [],
    checks: [],
    distinct: ["quiz_review_mode"],
    softRefs: [{ col: "level", ref: "course_levels", refCol: "value", note: "no FK in source/target; informational" }],
  },
  course_enrollments: {
    columns: [
      c("id", "uuid", "U36"), c("course_id", "text", "V255"), c("student_id", "uuid", "U36"),
      c("progress", "int", "INT"), c("enrolled_at", "timestamptz", "TS"),
    ],
    pk: ["id"],
    fks: [{ cols: ["course_id"], ref: "courses", onDelete: "cascade" }, { cols: ["student_id"], ref: "users", onDelete: "cascade" }],
    unique: [["course_id", "student_id"]],
    checks: [{ type: "between", col: "progress", min: 0, max: 100 }],
  },
  course_announcements: {
    columns: [
      c("id", "uuid", "U36"), c("course_id", "text", "V255"), c("author_id", "uuid", "U36"), c("title", "text", "V2000"),
      c("body", "text", "CLOB", { ec: true }), c("created_at", "timestamptz", "TS"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["id"],
    fks: [{ cols: ["course_id"], ref: "courses", onDelete: "cascade" }, { cols: ["author_id"], ref: "users", onDelete: "restrict" }],
    unique: [], checks: [],
  },
  chapters: {
    columns: [
      c("id", "text", "V255"), c("course_id", "text", "V255"), c("title", "text", "V2000"), c("sort_order", "int", "INT"),
      c("is_published", "bool", "B"), c("is_locked", "bool", "B"), c("created_at", "timestamptz", "TS"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["id"], fks: [{ cols: ["course_id"], ref: "courses", onDelete: "cascade" }], unique: [], checks: [],
  },
  topics: {
    columns: [
      c("id", "text", "V255"), c("chapter_id", "text", "V255"), c("title", "text", "V2000"), c("sort_order", "int", "INT"),
      c("is_published", "bool", "B"), c("is_locked", "bool", "B"), c("created_at", "timestamptz", "TS"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["id"], fks: [{ cols: ["chapter_id"], ref: "chapters", onDelete: "cascade" }], unique: [], checks: [],
  },
  lessons: {
    columns: [
      c("id", "text", "V255"), c("topic_id", "text", "V255"), c("course_id", "text", "V255", { nl: true }), c("title", "text", "V2000"),
      c("description", "text", "CLOB", { ec: true }), c("video_url", "text", "V2048", { nl: true }), c("sort_order", "int", "INT"),
      c("is_published", "bool", "B"), c("is_locked", "bool", "B"), c("created_at", "timestamptz", "TS"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["id"],
    fks: [{ cols: ["topic_id"], ref: "topics", onDelete: "cascade" }, { cols: ["course_id"], ref: "courses", onDelete: "cascade" }],
    unique: [], checks: [],
  },
  lesson_segments: {
    columns: [
      c("id", "text", "V255"), c("lesson_id", "text", "V255"), c("title", "text", "V2000"),
      c("duration", "text", "V20"), c("sort_order", "int", "INT"),
    ],
    pk: ["id"], fks: [{ cols: ["lesson_id"], ref: "lessons", onDelete: "cascade" }], unique: [], checks: [],
  },
  assignments: {
    columns: [
      c("id", "text", "V255"), c("course_id", "text", "V255"), c("lesson_id", "text", "V255", { nl: true }), c("created_by", "uuid", "U36"),
      c("type", "text", "V20", { to: "assignment_type" }), c("title", "text", "V2000"), c("due_date", "date", "DATE"),
      c("points", "numeric", "NUM"), c("instructions", "text", "CLOB", { nl: true }), c("time_limit", "int", "INT", { nl: true }),
      c("show_scores", "bool", "B"), c("quiz_review_mode", "text", "V30"), c("is_open", "bool", "B"),
      c("allow_edit_submission", "bool", "B"), c("allow_cancel_submission", "bool", "B"), c("quiz_attempt_limit", "int", "INT", { nl: true }),
      c("multi_select_scoring_mode", "text", "V30"), c("open_at", "timestamptz", "TS", { nl: true }), c("close_at", "timestamptz", "TS", { nl: true }),
      c("created_at", "timestamptz", "TS"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["id"],
    fks: [
      { cols: ["course_id"], ref: "courses", onDelete: "cascade" }, { cols: ["lesson_id"], ref: "lessons", onDelete: "cascade" },
      { cols: ["created_by"], ref: "users", onDelete: "restrict" },
    ],
    unique: [],
    checks: [
      { type: "enum", col: "type", values: ["file", "quiz"] }, { type: "gt", col: "points", value: 0 },
      { type: "gt", col: "time_limit", value: 0 },
    ],
    distinct: ["quiz_review_mode", "multi_select_scoring_mode"],
  },
  quiz_questions: {
    columns: [
      c("id", "uuid", "U36"), c("assignment_id", "text", "V255"), c("question_text", "text", "CLOB"),
      c("question_type", "text", "V30"), c("options", "jsonb", "JSON", { shape: "array" }), c("correct_index", "int", "INT", { nl: true }),
      c("correct_indices", "jsonb", "JSON", { nl: true, shape: "array" }), c("correct_answer", "text", "CLOB", { nl: true }),
      c("matching_pairs", "jsonb", "JSON", { nl: true, shape: "any" }), c("explanation", "text", "CLOB", { ec: true }),
      c("points", "numeric", "NUM"), c("is_required", "bool", "B"), c("sort_order", "int", "INT"),
    ],
    pk: ["id"], fks: [{ cols: ["assignment_id"], ref: "assignments", onDelete: "cascade" }], unique: [],
    checks: [
      { type: "enum", col: "question_type", values: ["multiple_choice", "fill_blank", "matching", "essay"] },
      { type: "gte", col: "correct_index", value: 0 },
    ],
  },
  submissions: {
    columns: [
      c("id", "uuid", "U36"), c("assignment_id", "text", "V255"), c("student_id", "uuid", "U36"),
      c("type", "text", "V20", { to: "submission_type" }), c("file_name", "text", "V2000", { nl: true }), c("file_path", "text", "V4000", { nl: true }),
      c("score", "numeric", "NUM", { nl: true }), c("previous_score", "numeric", "NUM", { nl: true }),
      c("question_scores", "jsonb", "JSON", { nl: true, shape: "any" }), c("answers", "jsonb", "JSON", { nl: true, shape: "any" }),
      c("is_manually_graded", "bool", "B"), c("submitted_at", "timestamptz", "TS"),
    ],
    pk: ["id"],
    fks: [{ cols: ["assignment_id"], ref: "assignments", onDelete: "cascade" }, { cols: ["student_id"], ref: "users", onDelete: "cascade" }],
    unique: [],
    checks: [
      { type: "enum", col: "type", values: ["file", "quiz"] }, { type: "gte", col: "score", value: 0 },
      { type: "gte", col: "previous_score", value: 0 },
    ],
  },
  meetings: {
    columns: [
      c("id", "text", "V255"), c("created_by", "uuid", "U36"), c("subject", "text", "V2000"), c("join_url", "text", "V2048"),
      c("start_datetime", "timestamptz", "TS"), c("end_datetime", "timestamptz", "TS"), c("passcode", "text", "V255"),
      c("created_at", "timestamptz", "TS"),
    ],
    pk: ["id"], fks: [{ cols: ["created_by"], ref: "users", onDelete: "restrict" }], unique: [], checks: [],
    orderPairs: [{ a: "start_datetime", b: "end_datetime", rule: "a<=b" }],
  },
  teacher_private_lesson_availability: {
    columns: [
      c("teacher_id", "uuid", "U36"), c("weekday", "smallint", "INT"), c("is_available", "bool", "B"),
      c("start_time", "time", "T5"), c("end_time", "time", "T5"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["teacher_id", "weekday"], fks: [{ cols: ["teacher_id"], ref: "users", onDelete: "cascade" }], unique: [],
    checks: [{ type: "between", col: "weekday", min: 0, max: 6 }, { type: "time_order", a: "start_time", b: "end_time" }],
  },
  student_lesson_completions: {
    columns: [
      c("id", "uuid", "U36"), c("student_id", "uuid", "U36"), c("lesson_id", "text", "V255"), c("completed_at", "timestamptz", "TS"),
    ],
    pk: ["id"],
    fks: [{ cols: ["student_id"], ref: "users", onDelete: "cascade" }, { cols: ["lesson_id"], ref: "lessons", onDelete: "cascade" }],
    unique: [["student_id", "lesson_id"]], checks: [],
  },
  live_classes: {
    columns: [
      c("id", "uuid", "U36"), c("course_id", "text", "V255"), c("lesson_id", "text", "V255", { nl: true }), c("room_name", "text", "V255"),
      c("title", "text", "V2000"), c("description", "text", "CLOB", { nl: true }), c("scheduled_at", "timestamptz", "TS", { nl: true }),
      c("duration_minutes", "int", "INT", { nl: true }), c("host_id", "uuid", "U36"), c("is_active", "bool", "B", { nl: true }),
      c("created_at", "timestamptz", "TS"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["id"],
    fks: [
      { cols: ["course_id"], ref: "courses", onDelete: "cascade" }, { cols: ["lesson_id"], ref: "lessons", onDelete: "set null" },
      { cols: ["host_id"], ref: "users", onDelete: "cascade" },
    ],
    unique: [["room_name"]], checks: [],
  },
  live_class_participants: {
    columns: [
      c("id", "uuid", "U36"), c("live_class_id", "uuid", "U36"), c("user_id", "uuid", "U36"), c("joined_at", "timestamptz", "TS", { nl: true }),
      c("left_at", "timestamptz", "TS", { nl: true }), c("duration_seconds", "int", "INT", { nl: true }),
    ],
    pk: ["id"],
    fks: [{ cols: ["live_class_id"], ref: "live_classes", onDelete: "cascade" }, { cols: ["user_id"], ref: "users", onDelete: "cascade" }],
    unique: [["live_class_id", "user_id"]], checks: [],
    orderPairs: [{ a: "joined_at", b: "left_at", rule: "a<=b" }],
  },
  private_lesson_requests: {
    columns: [
      c("id", "uuid", "U36"), c("student_id", "uuid", "U36"), c("teacher_id", "uuid", "U36"), c("course_id", "text", "V255"),
      c("requested_at", "timestamptz", "TS"), c("requested_slots", "jsonb", "JSON", { shape: "array" }),
      c("confirmed_at", "timestamptz", "TS", { nl: true }), c("duration_minutes", "int", "INT"), c("message", "text", "CLOB", { ec: true }),
      c("teacher_note", "text", "CLOB", { nl: true }), c("status", "text", "V20"), c("live_class_id", "uuid", "U36", { nl: true }),
      c("created_at", "timestamptz", "TS"), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["id"],
    fks: [
      { cols: ["student_id"], ref: "users", onDelete: "cascade" }, { cols: ["teacher_id"], ref: "users", onDelete: "cascade" },
      { cols: ["course_id"], ref: "courses", onDelete: "cascade" }, { cols: ["live_class_id"], ref: "live_classes", onDelete: "set null" },
    ],
    unique: [],
    checks: [
      { type: "between", col: "duration_minutes", min: 10, max: 120 },
      { type: "enum", col: "status", values: ["pending", "accepted", "declined", "cancelled"] },
    ],
  },
  lesson_live_broadcasts: {
    columns: [
      c("lesson_id", "text", "V255"), c("is_live", "bool", "B"), c("youtube_video_id", "text", "V255", { nl: true }),
      c("started_by", "uuid", "U36", { nl: true }), c("started_at", "timestamptz", "TS", { nl: true }),
      c("ended_at", "timestamptz", "TS", { nl: true }), c("updated_at", "timestamptz", "TS"),
    ],
    pk: ["lesson_id"],
    fks: [{ cols: ["lesson_id"], ref: "lessons", onDelete: "cascade" }, { cols: ["started_by"], ref: "users", onDelete: "set null" }],
    unique: [], checks: [],
    orderPairs: [{ a: "started_at", b: "ended_at", rule: "a<=b" }],
  },
};

// Preferred (tie-break) order from the Phase 4A brief; the real order is derived from FKs.
const PREFERRED_ORDER = [
  "users", "course_levels", "courses", "course_enrollments", "course_announcements", "chapters", "topics", "lessons",
  "lesson_segments", "assignments", "quiz_questions", "submissions", "meetings", "teacher_private_lesson_availability",
  "student_lesson_completions", "live_classes", "live_class_participants", "private_lesson_requests", "lesson_live_broadcasts",
];

module.exports = { TABLES, TGT, PREFERRED_ORDER };
