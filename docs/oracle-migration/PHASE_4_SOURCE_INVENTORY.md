# Phase 4 Source Inventory (Phase 4A)

## Production (authoritative)

Produced by `node scripts/migration/preflight-source.cjs --use-database-url --production-read` on 2026-10-07 (report: `migration-reports/source-preflight.json`, gitignored, counts and primary keys only).

| Item | Value |
|---|---|
| Server | CockroachDB CCL v26.2.7 (PostgreSQL wire protocol) |
| Host / port / database | `tdk-it-27460.j77.aws-ap-southeast-1.cockroachlabs.cloud` / 26257 / `lms_db` |
| Source selected via | `DATABASE_URL` with `--use-database-url` (no `MIGRATION_SOURCE_DATABASE_URL` was set; both name the same cluster) |
| Session | `READ ONLY`, `TIME ZONE UTC`, `SERIALIZABLE` snapshot, statement allow-list (`SELECT`/`WITH`/`SHOW`) |
| Business tables present | **15 / 19** |
| Extra non-canonical tables | 0 (`schema_migrations` excluded by policy) |
| Total source rows | **41** (computed from per-table counts as integers) |
| Production export / Oracle import | Not executed |

| # | Table | Source rows | Effective migration rows | Source status |
|---|---|---:|---:|---|
| 1 | users | 4 | 4 | present |
| 2 | course_levels | 2 | 2 | present |
| 3 | courses | 1 | 1 | present |
| 4 | course_enrollments | 2 | 2 | present |
| 5 | course_announcements | n/a | 0 | `source_absent` |
| 6 | chapters | 1 | 1 | present (missing 2 columns) |
| 7 | topics | 2 | 2 | present (missing 2 columns) |
| 8 | lessons | 4 | 4 | present |
| 9 | lesson_segments | 0 | 0 | present |
| 10 | assignments | 3 | 3 | present |
| 11 | quiz_questions | 10 | 10 | present |
| 12 | submissions | 5 | 5 | present |
| 13 | meetings | 0 | 0 | present |
| 14 | teacher_private_lesson_availability | n/a | 0 | `source_absent` |
| 15 | student_lesson_completions | 7 | 7 | present |
| 16 | live_classes | 0 | 0 | present |
| 17 | live_class_participants | 0 | 0 | present |
| 18 | private_lesson_requests | n/a | 0 | `source_absent` |
| 19 | lesson_live_broadcasts | n/a | 0 | `source_absent` |

`n/a` is a display value only. It is never summed; absent tables contribute the number 0.

### Source schema gaps (`SOURCE_SCHEMA_GAP`, 8)

These are schema-version differences, not corrupt data. They are reported separately from data blockers and do not block Phase 4B by themselves.

Absent tables (policy `source_absent`: source rows = 0, Oracle table stays empty, no rows invented). Git history (`git log -S"CREATE TABLE IF NOT EXISTS <t>" -- lib/db.ts`) shows each was first created by a feature commit, and no earlier table was renamed into them, so there is no legacy equivalent to migrate:

| Table | Introduced by |
|---|---|
| teacher_private_lesson_availability | `14c982f` 2026-09-04 (private lessons) |
| private_lesson_requests | `14c982f` 2026-09-04 (private lessons) |
| course_announcements | `4d7a689` 2026-09-08 (announcements, live broadcasts) |
| lesson_live_broadcasts | `4d7a689` 2026-09-08 |

Absent columns (policy `canonical_default`, applied to every source row of the table):

| Column | Value written to Oracle | Basis |
|---|---:|---|
| chapters.is_published | 1 | `lib/db.ts` adds it as `BOOLEAN NOT NULL DEFAULT TRUE`; Oracle `NUMBER(1) DEFAULT 1 NOT NULL`; `app/api/data/route.ts` reads missing as published |
| chapters.is_locked | 0 | `DEFAULT FALSE`; Oracle `DEFAULT 0 NOT NULL`; app reads missing as unlocked |
| topics.is_published | 1 | same as chapters |
| topics.is_locked | 0 | same as chapters |

Policy source of truth: `scripts/migration/lib/source-gaps.cjs`. The export and import must apply these defaults explicitly (today `export-cockroach.cjs` aborts on a missing column, so Phase 4B needs this change before any export).

### Warnings (3)

`course_enrollments(course_id, student_id)`, `student_lesson_completions(student_id, lesson_id)` and `live_class_participants(live_class_id, user_id)` have no UNIQUE constraint in the source. The duplicate audit is authoritative and found 0 duplicate groups.

### Audit results

| Audit | Result |
|---|---|
| UUID, PK | PASS (15 tables, 0 null/duplicate PKs, no non-canonical UUIDs) |
| FK orphans | PASS (22 FKs with a present parent plus 1 soft reference, 0 orphans) |
| Unique | PASS (7 constraints, 0 duplicate groups) |
| NOT NULL | PASS |
| VARCHAR2 byte length | PASS (tightest: `assignments.multi_select_scoring_mode` 18 of 30 bytes) |
| Enum / CHECK | PASS (7 enum columns, all values inside the Oracle lists) |
| Boolean | PASS |
| JSON | PASS (5 columns, 0 invalid, 0 string-encoded, 0 double-encoded) |
| Timestamp / date / time | PASS |
| Empty strings | ACTION REQUIRED: `lessons.description` 4, `quiz_questions.explanation` 10 (both to `EMPTY_CLOB()`); no whitespace-only values |
| Numeric precision | ACTION REQUIRED: 1 row beyond scale 4 (below) |

### Numeric scale (`TRANSFORMATION_REQUIRED`, 1 row)

| Table.column | Row id | Source value | Oracle `NUMBER(12,4)` value |
|---|---|---|---|
| submissions.score | `de4599ca-b1e3-4065-a761-f5d7bee2f4f9` | `16.78333333333333` (14 fractional digits) | `16.7833` |

Policy: round half away from zero to scale 4, computed on exact decimal strings (no floating point), only when the importer is run with an explicit `--allow-scale-rounding`; the affected row must appear in the migration report. Without the flag the importer must fail. Every other numeric column, including the integer-typed ones, was audited by casting to `DECIMAL` and fits its Oracle scale.

---

## Local development (historical evidence only)

From the earlier Phase 4A run against `localhost:5432/lms_db_mathbyseng` (PostgreSQL 17.5, `migration-reports/local-dev-preflight.json`). Not the production baseline.

| Table | Rows |
|---|---:|
| users | 3 |
| course_levels | 1 |
| courses | 1 |
| course_enrollments | 1 |
| chapters | 1 |
| topics | 1 |
| lessons | 3 |
| assignments | 3 |
| quiz_questions | 4 |
| submissions | 7 |
| student_lesson_completions | 3 |
| all other tables | 0 or absent |

15 of 19 tables, 28 rows. The same four tables and four columns were missing, because that database predates those features. Its `submissions.score` had 2 rows beyond scale 4. The seeded anomaly database `lms_test_phase4a` proved the checks detect orphans, duplicates, oversize strings, bad enums, and string- and double-encoded JSON.

## Phase 4B production snapshot (2026-10-07)

Fresh production preflight (CockroachDB CCL v26.2.7, `lms_db`) matched the earlier audit: 15 of 19 physical tables, 41 effective rows, 0 data blockers. Source-schema gaps are unchanged (4 absent tables, 4 absent chapter/topic columns). Export `phase4-production-20261007T180359Z` holds 19 files with the same 41 rows. Schema fingerprint `8b6d0200f4eb46b9bf81051f9583856653d8b3793f32174611d5d0eae4e6a231`; manifest SHA-256 `b18226a10f3cc795966853661cec9eafb4ac42d5face04545a8bf73d431b6868`. See `PHASE_4_DATA_MIGRATION.md` section 19.

## Phase 4C Oracle baseline (2026-10-07)

The snapshot above was imported into Oracle `LMS_APP` (41 rows, 19 tables) and validated against the export. Oracle is a baseline copy; CockroachDB remains the live source. See `PHASE_4_DATA_MIGRATION.md` section 20.
