# CockroachDB to Oracle Data Migration Compatibility

This is a schema/data compatibility plan only. No source rows were exported or imported in Phase 2.

| Table and Cockroach columns | Cockroach type(s) | Oracle target | Transformation | Risk / validation |
|---|---|---|---|---|
| `users`: `id`, identity/profile fields, flags, created time | UUID, TEXT, BOOLEAN, TIMESTAMPTZ | `VARCHAR2(36)`, `VARCHAR2`, `NUMBER(1)`, `TIMESTAMP WITH TIME ZONE` | UUID text unchanged; booleans 0/1 | validate UUID format, unique email/username, role, timestamp instant |
| `course_levels`: id/value/label/order/time | UUID, TEXT, INT, TIMESTAMPTZ | `VARCHAR2(36)`, `VARCHAR2`, `NUMBER(10,0)`, timestamp TZ | map `value` to `level_value` | check unique level values and order range |
| `courses`: id/text fields/instructor/settings/times | TEXT, UUID, BOOLEAN, TIMESTAMPTZ | `VARCHAR2`, `VARCHAR2(36)`, `NUMBER(1)`, timestamp TZ | map `level` to `course_level`; booleans 0/1 | IDs longer than 255 and invalid instructor references must be reported |
| `chapters`, `topics`, `lessons`, `lesson_segments` | TEXT, INT, BOOLEAN, TIMESTAMPTZ | `VARCHAR2`, `NUMBER(10,0)`, `CLOB` description, timestamp TZ | booleans 0/1; preserve text IDs | hierarchy parent existence, nullable `lessons.course_id`, text length, timestamps |
| `course_enrollments` | UUID/TEXT, INT, TIMESTAMPTZ | UUID text, `NUMBER(10,0)`, timestamp TZ | unchanged IDs; numeric conversion | duplicate `(course_id, student_id)`, 0–100 progress, parents |
| `course_announcements` | UUID/TEXT, TIMESTAMPTZ | UUID text, `VARCHAR2`, `CLOB`, timestamp TZ | body to CLOB | CLOB fidelity, course/author parent existence |
| `assignments` | TEXT, UUID, DATE, INT, BOOLEAN, TIMESTAMPTZ | `VARCHAR2`, UUID text, `DATE`, `NUMBER(12,4)`, `NUMBER(1)`, timestamp TZ | map `type` to `assignment_type`; points/flags normalized | valid type, positive points/time limit, date-only preservation, parents |
| `quiz_questions` | UUID/TEXT, JSONB, NUMERIC, BOOLEAN | UUID text, CLOB + `IS JSON`, `NUMBER(12,4)`, `NUMBER(1)` | serialize JSON exactly once | parse and structural JSON comparison; valid question type/index; preserve fractional points |
| `submissions` | UUID/TEXT, JSONB, NUMERIC, BOOLEAN, TIMESTAMPTZ | UUID text, CLOB + `IS JSON`, `NUMBER(12,4)`, `NUMBER(1)`, timestamp TZ | map `type` to `submission_type`; JSON serialization | JSON/scoring parity, non-negative scores, parent references |
| `meetings` | TEXT, UUID, TIMESTAMPTZ | `VARCHAR2`, UUID text, timestamp TZ | no identifier regeneration | URL/text length, creator parent, start/end instant fidelity |
| `teacher_private_lesson_availability` | UUID, SMALLINT, BOOLEAN, TIME, TIMESTAMPTZ | UUID text, `NUMBER(10,0)`, `NUMBER(1)`, `VARCHAR2(5)`, timestamp TZ | format time as zero-padded `HH24:MI` | weekday 0–6; regex and lexical `start_time < end_time`; one row per teacher/day |
| `student_lesson_completions` | UUID/TEXT, TIMESTAMPTZ | UUID text, `VARCHAR2`, timestamp TZ | unchanged IDs | unique `(student_id, lesson_id)`, parents |
| `live_classes` | UUID/TEXT, BOOLEAN, INT, TIMESTAMPTZ | UUID text, `VARCHAR2`, `NUMBER(1)`, `NUMBER(10,0)`, timestamp TZ | booleans 0/1 | room-name uniqueness, nullable lesson, parent links |
| `live_class_participants` | UUID, INT, TIMESTAMPTZ | UUID text, `NUMBER(10,0)`, timestamp TZ | unchanged IDs | unique class/user pair and parent links |
| `private_lesson_requests` | UUID/TEXT, JSONB, INT, TIMESTAMPTZ | UUID text, CLOB + `IS JSON`, `NUMBER(10,0)`, timestamp TZ | JSON serialization; live class FK after live class import | required slot JSON, duration 10–120, status, all parents |
| `lesson_live_broadcasts` | TEXT, UUID, BOOLEAN, TIMESTAMPTZ | `VARCHAR2`, UUID text, `NUMBER(1)`, timestamp TZ | booleans 0/1 | lesson/starter parents and timestamp fidelity |

## Cross-cutting data risks

- Oracle treats zero-length character strings as `NULL`, unlike PostgreSQL/CockroachDB. Existing default-empty `description`, `body`, `explanation`, and `message` values need a deliberate import representation and route contract before data transfer; this phase does not silently substitute a value.
- Oracle identifier/key columns are bounded `VARCHAR2`; audit Cockroach text IDs and indexed strings before transfer. The chosen limits are documented in the migration DDL and deliberately produce a preflight failure rather than truncation.
- JSON checks validate syntax, not quiz-answer business semantics. Phase 4 must parse JSON and compare canonical structures, including legacy string-encoded JSON.
- UUIDs must be imported as their existing lower/hyphenated textual values. They are not regenerated.
- `ON DELETE RESTRICT` maps to Oracle's default no-action behavior. Cascade and set-null actions are explicit in the DDL.
- Date-only due dates retain a `DATE` target, but the product business timezone for deadline interpretation remains unresolved.
