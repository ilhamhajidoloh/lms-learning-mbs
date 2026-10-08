# Phase 4A: Data Migration Discovery, Mapping and Export Design

**Status: PARTIAL.** The production preflight ran (2026-10-07) with **0 data blockers**. Three transformations and eight source-schema gaps have defined policies. Phase 4B still needs the importer and exporter changes listed in section 19. Production export has not been run and nothing was written to Oracle.

## 1. Source environment

| Item | Value |
|---|---|
| Production source | CockroachDB CCL v26.2.7, database `lms_db`, `tdk-it-27460.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257` |
| Business tables present | 15 of 19 |
| Total source rows | 41 |
| Session | `READ ONLY`, `SERIALIZABLE` snapshot, `TIME ZONE UTC`, statement allow-list (`SELECT`/`WITH`/`SHOW`) |
| Credentials | Never printed or stored in docs or reports |

Production numbers are in `PHASE_4_SOURCE_INVENTORY.md`. Local development and the seeded `lms_test_phase4a` database remain only as historical evidence that the tooling detects problems.

### Report classification

Each preflight issue has one `classification`, and `migration-reports/source-preflight.json` exposes them as separate arrays with numeric counts:

| Classification | JSON array | Meaning | Blocks 4B |
|---|---|---|---|
| `DATA_BLOCKER` | `dataBlockers` | orphan FK, duplicate key, bad enum, NOT NULL, oversize string, invalid JSON, bad UUID | yes |
| `TRANSFORMATION_REQUIRED` | `transformationsRequired` | defined transform the importer must apply (EMPTY_CLOB, `''`→NULL, scale rounding) | no, if the importer supports it |
| `SOURCE_SCHEMA_GAP` | `sourceSchemaGaps` | older source schema (absent table or column) with a defined policy | no |
| `WARNING` | `warnings` | review item | no |

A check that finds 0 violating rows emits nothing. Counts are integers; INT8 values from CockroachDB are parsed to numbers (an unsafe value throws), and `sourceRowCount` is summed from numbers.

## 2. Target environment

Oracle Autonomous Database, schema `LMS_APP`, service `gc89df1f33bea77_mydbwork_high.adb.oraclecloud.com`. Live check in Phase 4A: all 19 business tables exist and contain **0 rows**. Character set `AL32UTF8`, `NLS_LENGTH_SEMANTICS=BYTE` (so every `VARCHAR2(n)` limit is in bytes, which matters for Thai text).

## 3. Tooling delivered

| File | Purpose |
|---|---|
| `scripts/migration/lib/spec.cjs` | Single source of truth for the column mapping |
| `scripts/migration/build-manifest.cjs` | Generates `database/migration/migration-manifest.json` and `source-to-oracle-map.json`; derives FK order |
| `scripts/migration/preflight-source.cjs` | Read-only audit; writes `migration-reports/source-preflight.json` |
| `scripts/migration/export-cockroach.cjs` | Read-only NDJSON export with checksums (not run on production) |
| `scripts/migration/import-oracle.cjs` | Import design; only `--dry-run` works in Phase 4A |
| `scripts/migration/lib/transform.cjs` | Shared value transforms (export checksums and import use the same code) |
| `scripts/migration/selftest.cjs` | 17 offline tests of transform, JSON, report/count typing, decimal rounding, gap policy and ordering rules |
| `scripts/migration/seed-test-source.cjs` | Seeds a disposable `lms_test*` DB, optionally with deliberate anomalies |

`npm run migrate:manifest | migrate:selftest | migrate:preflight | migrate:export | migrate:import:dryrun`.

Note: `/scripts`, `/database`, `/docs` and `*.sql` are listed in `.gitignore` in this repo, so these files are untracked unless force-added or the ignore rules change. That is a pre-existing setting; I did not alter it.

## 4. 19-table inventory and row counts

See `PHASE_4_SOURCE_INVENTORY.md` for the exact production counts. Production has 15 of 19 tables and 41 rows.

Source-schema-gap policy (`scripts/migration/lib/source-gaps.cjs`, confirmed against `lib/db.ts`, the Oracle DDL, `app/api/data/route.ts` and git history):

| Gap | Policy |
|---|---|
| Table absent: `course_announcements`, `teacher_private_lesson_availability`, `private_lesson_requests`, `lesson_live_broadcasts` | `source_absent`: source rows 0, effective migration rows 0, Oracle table stays empty. All four were first created by feature commits `14c982f` (2026-09-04) and `4d7a689` (2026-09-08); none is a renamed legacy table. No rows are created |
| Column absent: `chapters.is_published`, `topics.is_published` | Every row gets **1** (Oracle `DEFAULT 1 NOT NULL`; source `migrateDatabase` adds `BOOLEAN NOT NULL DEFAULT TRUE`; app treats missing as published) |
| Column absent: `chapters.is_locked`, `topics.is_locked` | Every row gets **0** (Oracle `DEFAULT 0 NOT NULL`; source `DEFAULT FALSE`; app treats missing as unlocked) |

These do not block Phase 4B. `export-cockroach.cjs` currently throws on a missing column; it must apply this policy before the export is run (section 19).

No extra legacy tables were found. `schema_migrations` is excluded by policy.

## 5. Dependency graph and definitive import order

Derived from the FK definitions in the manifest (Kahn sort, ties broken by the brief's preferred order). **No cycles. No self-references.**

| # | Table | Depends on |
|---|---|---|
| 1 | users | none |
| 2 | course_levels | none |
| 3 | courses | users |
| 4 | course_enrollments | courses, users |
| 5 | course_announcements | courses, users |
| 6 | chapters | courses |
| 7 | topics | chapters |
| 8 | lessons | topics, courses |
| 9 | lesson_segments | lessons |
| 10 | assignments | courses, lessons, users |
| 11 | quiz_questions | assignments |
| 12 | submissions | assignments, users |
| 13 | meetings | users |
| 14 | teacher_private_lesson_availability | users |
| 15 | student_lesson_completions | users, lessons |
| 16 | live_classes | courses, lessons, users |
| 17 | live_class_participants | live_classes, users |
| 18 | private_lesson_requests | users, courses, live_classes |
| 19 | lesson_live_broadcasts | lessons, users |

This matches the brief's expected order exactly. `courses.level` has no FK to `course_levels` in source or target, so it is checked only as an informational soft reference.

## 6. ID and UUID policy

IDs are copied byte for byte. Nothing in the export or import path calls `randomUUID()` or `SYS_GUID()`. UUID-typed source columns are exported via `::text` (lowercase hyphenated). The preflight reports null or duplicate PKs, non-canonical UUIDs (uppercase, 32-hex without hyphens, other formats), whitespace and empty IDs. Text-typed IDs (`courses.id`, `lessons.id` and so on) are free-form in the app and are preserved as-is, with a length check against `VARCHAR2(255)`.

## 7. Column renames (data migration only)

```text
courses.level             -> courses.course_level
course_levels.value       -> course_levels.level_value
assignments.type          -> assignments.assignment_type
submissions.type          -> submissions.submission_type
```

Machine-readable: `database/migration/source-to-oracle-map.json`. API field names do not change.

## 8. Transformation rules

| Class | Count | Rule |
|---|---:|---|
| COPY | 86 | Unchanged |
| RENAME | 4 | Column rename only |
| BOOLEAN_TRANSFORM | 19 | `true`→1, `false`→0, `NULL`→`NULL` only where the target is nullable. Never strings. Any other value is a hard error |
| JSON_SERIALIZE | 6 | Decode any string-encoded layers, then `JSON.stringify` once. `NULL` stays `NULL` |
| EMPTY_CLOB | 4 | See 11 |
| NULL_POLICY | 12 | Nullable text: `''`→`NULL`. Whitespace unchanged |
| TIMESTAMP_TRANSFORM | 35 | See 12 |
| DATE_COPY | 1 | `YYYY-MM-DD` string, never through `Date` |
| TIME_STRING | 2 | `HH24:MI` string, never through `Date` |
| NUMERIC_SCALE | 4 | Exact decimal string; more than 4 fractional digits is rejected unless `--allow-scale-rounding` is given (see 9) |

Booleans: 19 columns across users, courses, chapters, topics, lessons, assignments, quiz_questions, submissions, teacher_private_lesson_availability, live_classes and lesson_live_broadcasts.

## 9. Numeric precision (`numeric_precision_risk`)

Oracle targets are `NUMBER(12,4)` for points and scores. The export keeps numerics as exact decimal strings. The audit casts every numeric and integer column to `DECIMAL` (exact, never FLOAT) before `round(x, scale)`, because CockroachDB has no `round(INT, INT)`.

Production result: exactly **1 row** exceeds scale 4.

| Table.column | Row id | Source value | Oracle `NUMBER(12,4)` value |
|---|---|---|---|
| submissions.score | `de4599ca-b1e3-4065-a761-f5d7bee2f4f9` | `16.78333333333333` | `16.7833` |

Policy (classified `TRANSFORMATION_REQUIRED`, not a data blocker): round **half away from zero** to scale 4 on exact decimal strings during import. The importer must refuse to round unless run with an explicit `--allow-scale-rounding`, and must list every rounded row (table, column, id, source value, stored value) in the migration report. It never rounds silently. The Oracle schema is not changed. The report records only the id and the value for the affected row. `lib/decimal.cjs` implements the rounding and is covered by self-tests.

Local development had 2 such rows (historical). Integer columns (`progress`, `sort_order`, `duration_minutes` and so on) are checked against `NUMBER(10,0)` capacity. `assignments.points` is `integer` and `NUMBER(12,4)` in Oracle, a safe widening.

## 10. JSON policy

Six columns: `quiz_questions.options`, `correct_indices`, `matching_pairs`, `submissions.answers`, `question_scores`, `private_lesson_requests.requested_slots`.

The preflight reads each value as text and reports total, `NULL`, `[]`, `{}`, structured, scalar, string-encoded, double-encoded, plain-string, JSON `null` and invalid counts, plus the source column type and any number that would not survive a JS round trip.

Rule: `NULL`→`NULL`. Otherwise decode string layers until a non-string value is reached, then `JSON.stringify` exactly once. Invalid JSON is a blocker. Compare in Phase 5 by parsed structure, not by raw text (key order and whitespace may differ).

Production result: the 5 JSON columns that exist (`private_lesson_requests` is absent) are native `jsonb` with 0 invalid, 0 string-encoded, 0 double-encoded rows. Some columns hold SQL NULL (`correct_indices`/`matching_pairs` 8 of 10, `answers`/`question_scores` 2 of 5), which stay NULL. The seeded anomaly database confirmed detection of both a string-encoded and a double-encoded value.

## 11. Empty-string policy

| Case | Rule |
|---|---|
| NOT NULL text (`lessons.description`, `course_announcements.body`, `quiz_questions.explanation`, `private_lesson_requests.message`): `NULL` or `''` | `EMPTY_CLOB()` |
| Same fields, whitespace-only or text | Unchanged. Never trimmed |
| Nullable text: `''` | `NULL` (Oracle cannot tell them apart) |
| Nullable text: `NULL` / whitespace / text | Unchanged |
| Any NOT NULL non-CLOB column that is `''` | **Blocker** (Oracle would store `NULL`) |

The transform returns `''` as a marker for EMPTY_CLOB; the importer must bind `NVL(:v, EMPTY_CLOB())` and never a bare empty string. All text columns, not just the four above, are audited for NULL, empty, whitespace-only and non-empty counts.

Production result (`TRANSFORMATION_REQUIRED`): `lessons.description` has 4 empty strings and `quiz_questions.explanation` has 10. Both map to `EMPTY_CLOB()`. No NULLs in those fields, no whitespace-only values, and no empty strings in any other text column (so no `''`→NULL conversions are needed). `course_announcements.body` and `private_lesson_requests.message` are in absent tables.

## 12. Timestamps, dates and times

- Instants (35 columns) are exported by the source as `to_char(col AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` inside a session set to UTC. The importer must bind these as UTC (`TO_TIMESTAMP_TZ(..., 'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"')`). Verified on the seeded database: `2026-10-07 12:30:00+07` exports as `2026-10-07T05:30:00.000000Z`, and a value stored as `05:30:00+00` exports as the identical string, so equal instants give equal output with no +7/-7 shift. Microsecond precision is preserved.
- Date-only: `assignments.due_date` is exported as `YYYY-MM-DD` text, never a JS `Date`.
- Time-only: availability `start_time`/`end_time` are exported as `HH24:MI` text. A value with non-zero seconds or `24:00` is flagged.
- The preflight reports min/max per instant column, NULL counts, fractional-second counts, implausible years and `start > end` pairs (informational, no Oracle constraint).

Production result: PASS. No infinite or out-of-range timestamps, no non-canonical dates, no `24:00` or non-zero-second time values (the time-only columns are in absent tables).

## 13. Length, enum, NOT NULL, unique and orphan checks

- **VARCHAR2 length:** compared in bytes against each target length. Overflow is a blocker.
- **Enums / CHECKs:** distinct values are reported and compared with the Oracle CHECK lists (role, assignment type, submission type, question type, request status), plus ranges (progress 0-100, weekday 0-6, duration 10-120, positive points, non-negative scores, start < end). Unknown values are never remapped.
- **NOT NULL:** source NULL count for every Oracle NOT NULL column without a transform rule. Any hit is a blocker for that table.
- **Unique:** all 7 Oracle unique constraints (users.email, users.username, course_levels.value, enrollment pair, completion pair, live_classes.room_name, participant pair) are checked for duplicate groups.
- **Orphans:** every FK is checked with a left join. Orphan rows are listed by primary key only.

Production result: no length, enum, NOT NULL, unique or orphan problems. Observed values: roles admin/student/teacher; assignment types file/quiz; question types essay/fill_blank/matching/multiple_choice; `quiz_review_mode` full/none; `multi_select_scoring_mode` correct_only/penalize_incorrect; submission types file/quiz. Tightest VARCHAR2 is 18 of 30 bytes. 22 FKs plus 1 soft reference: 0 orphans. 7 unique constraints: 0 duplicate groups.

Seeded anomaly database (tooling test): the preflight caught 5 blockers (orphan lesson segment, duplicate enrollment pair, 1001-byte display name, 5-decimal score, invalid role) and 4 warnings (string- and double-encoded JSON, missing source unique and FK constraints), and exited with code 2.

## 14. Export design

- Format: NDJSON, one object per line, keys in manifest order, rows ordered by primary key (keyset pagination in a single serializable read-only snapshot, so all tables are mutually consistent).
- Directory (gitignored via `/migration-data/`): `manifest.json`, `<table>.ndjson` ×19, `checksums.json`, `row-counts.json`.
- Checksums: per table row count, SHA-256 of the file, SHA-256 of the primary-key list, and a **logical** SHA-256 of the transformed (Oracle-bound) row values. Repeat exports of an unchanged source are byte-identical (verified).
- Safety: refuses any non-disposable source without `--production-export`; refuses without a clean preflight report for the same host/port/database and unchanged row counts; refuses to overwrite an existing export without `--overwrite`; `--dry-run` writes nothing. `DATABASE_URL` is never used implicitly: select a source with `MIGRATION_SOURCE_DATABASE_URL` or `--use-database-url`.
- Logs contain table names, counts, progress and checksums only.

## 15. Import design (not enabled)

`import-oracle.cjs --dry-run` verifies the export (manifest hash, file checksums, order), runs every row through the real transform, checks lengths, NOT NULL and primary-key duplicates, and with `--check-target` reads Oracle identity and business table counts. Verified against the live target: schema `LMS_APP`, all 19 tables empty. Real mode is refused.

Phase 4B design:

1. Required flags: `--confirm-target-oracle --target-schema=LMS_APP --target-service=<name>`. Mismatch with the connected schema/service aborts.
2. Refuse if any business table is non-empty, unless `--resume` with a matching ledger.
3. Tables in manifest order; batches of `MIGRATION_BATCH_SIZE` (default 500); array `executeMany` with named binds and explicit CLOB handling.
4. Transactions: one transaction per batch, committed with the ledger row for that batch. Never one transaction for the whole database.
5. Ledger table `migration_ledger(run_id, table_name, batch_no, first_pk, last_pk, rows, status, export_sha256)`. A table is complete only when its ledger rows cover the export row count and the target count matches.
6. Failure: stop at the first error. Rerun with `--resume` skips committed batches (verified by ledger and target count); a partially failed table can be truncated and replayed because FK parents are already complete. A partial import is never reported as complete.
7. IDs are never regenerated. FKs stay enabled; the FK-safe order makes disabling them unnecessary.

## 16. Phase 5 validation requirements

Row counts equal to `row-counts.json`; PK set equality (via `pk_sha256`); FK integrity query per FK; unique constraints; JSON parsed-structure parity; UUID/ID preservation; boolean parity; timestamp equality as instants; date and time-string equality; numeric equality at the agreed scale; empty-text transformation counts; logical checksum parity; sample business records (below); application regression through the existing Phase 3 route tests with `DB_PROVIDER=oracle`.

Sampling (deterministic, no sensitive content in reports): the first and last 3 IDs by primary key per table, every course with its full hierarchy (chapters, topics, lessons, segments), the 5 submissions with the most JSON content, all live classes with participants, and all private lesson requests that have a `live_class_id`. Reports contain IDs and equality results only.

## 17. Security and sensitive data

Exports contain emails, usernames, password hashes, messages, answers and private lesson details. They live only in `/migration-data/` (gitignored), are never uploaded, and are deleted after Phase 5 sign-off. Reports in `/migration-reports/` (also gitignored) contain counts and primary keys only. Scripts print host, port, database and user, never passwords. The source session is READ ONLY with a statement allow-list.

## 18. Hardening issues deliberately not touched

`due_date` enforcement, the submission POST enrollment gap, manual grade authorization, simultaneous first-submission duplicates and private lesson product gaps are unchanged. Data is migrated as-is.

## 19. Phase 4B production export: COMPLETE

Authoritative production baseline snapshot (not the cutover snapshot; production keeps running).

| Item | Value |
|---|---|
| Export directory (Git-ignored) | `migration-data/phase4-production-20261007T180359Z` |
| Export timestamp (UTC) | 2026-10-07T18:04:03Z to 18:04:05Z |
| Source | CockroachDB CCL v26.2.7, database `lms_db`, selected via `DATABASE_URL (--use-database-url)`, guard `--production-export` |
| Session | READ ONLY, TIME ZONE UTC, SERIALIZABLE snapshot |
| Fresh preflight | `migration-reports/phase4b-production-preflight.json` (2026-10-07T18:03:36Z): 0 data blockers, 3 approved transformations, 8 source-schema gaps, 3 warnings |
| Source schema fingerprint | `8b6d0200f4eb46b9bf81051f9583856653d8b3793f32174611d5d0eae4e6a231` (preflight == export) |
| Preflight fingerprint | same value; export manifest records the preflight file and fingerprint |
| `manifest.json` SHA-256 (snapshot identity) | `b18226a10f3cc795966853661cec9eafb4ac42d5face04545a8bf73d431b6868` |
| Physical source tables | 15 / 19 |
| Canonical files | 19 / 19 |
| Total rows | 41 (preflight == export; unchanged from the earlier audit) |
| SHA-256 | 19 / 19 match (independent recompute) |
| Logical checksums | 19 / 19 match |
| Approved transformations planned | `lessons.description` 4 rows and `quiz_questions.explanation` 10 rows to `EMPTY_CLOB()`; `submissions.score` 1 row (id `de4599ca-...`) 16.78333333333333 to 16.7833 |

Per-table rows: users 4, course_levels 2, courses 1, course_enrollments 2, course_announcements 0 (source absent), chapters 1, topics 2, lessons 4, lesson_segments 0, assignments 3, quiz_questions 10, submissions 5, meetings 0, teacher_private_lesson_availability 0 (source absent), student_lesson_completions 7, live_classes 0, live_class_participants 0, private_lesson_requests 0 (source absent), lesson_live_broadcasts 0 (source absent).

The export keeps the exact source decimal (`16.78333333333333`); the importer applies the rounding and still requires `--allow-scale-rounding`. Without the flag the dry run refuses; with it the dry run passes with 0 Oracle writes. `chapters` and `topics` rows carry `is_published=true`, `is_locked=false`. All IDs match the live source ID sets exactly.

The directory is immutable. Never edit an NDJSON file; if anything must change, discard the whole export and run a new one. Phase 4C must use exactly this snapshot (manifest SHA-256 above).

Not done in this phase: production import, `DB_PROVIDER` switch. Next: Phase 4C controlled Oracle import.

## 20. Phase 4C controlled Oracle import: COMPLETE

The frozen Phase 4B snapshot was imported into Oracle `LMS_APP` as a **baseline copy only**. Production is still CockroachDB (`DB_PROVIDER=postgres`); this is not cutover synchronization, and the source may have drifted since 2026-10-07T18:04Z.

| Item | Value |
|---|---|
| Snapshot | `migration-data/phase4-production-20261007T180359Z`, manifest SHA-256 `b18226a10f3cc795966853661cec9eafb4ac42d5face04545a8bf73d431b6868` (verified before import) |
| Pre-import checks | manifest hash match; SHA-256 19/19; logical checksums 19/19; target LMS_APP empty (19 tables, 0 rows, 10 migrations); dry run OK with 1 rounding row |
| Import | `import-oracle.cjs --execute --confirm-target-oracle --target-schema=LMS_APP --allow-scale-rounding`, 2026-10-07T18:16:38Z to 18:16:46Z, per-table batch commits in FK order |
| Ledger / run ID | `migration-reports/phase4c-import-ledger.json`, status COMPLETE, run id = manifest SHA-256, 19 tables, 41 rows committed |
| Report | `migration-reports/phase4c-oracle-import.json` (counts, IDs, verdicts only) |

Validation (`scripts/migration/validate-phase4c-import.cjs`, read-only on Oracle): row counts 19/19 (41 = 41); primary key sets 19/19; Oracle-side logical checksum recomputed from Oracle values through the shared transform, 19/19 equal to the export checksums; 350 non-null field comparisons, 0 mismatches (20 JSON compared by parsed structure, 44 timestamps by UTC instant to microseconds, 3 dates, 48 booleans); 31 FK relationships, 0 orphans; 7 unique constraints, 0 duplicate groups; all P/R/U constraints ENABLED; password hashes 4/4 equal (compared, not printed); `chapters` 1/1 and `topics` 2/2 have `is_published=1, is_locked=0`.

Approved transforms applied: EMPTY_CLOB `lessons.description` 4 and `quiz_questions.explanation` 10 (stored length 0, read back as empty); one scale rounding, `submissions.score` id `de4599ca-...` 16.78333333333333 to 16.7833.

Application checks (local `DB_PROVIDER=oracle` dev server, stopped afterwards): `validate-oracle-schema` passed (19 tables), connectivity passed, `/api/health` reports provider oracle, `/api/public/catalog` returns the imported course and levels, `/api/data` returns 401 without a token. Authenticated login was not run (no safe credential); `/api/data` authenticated reads were not run. The Phase 3 verifier/3H/3IJ/3KL/3G suites insert and delete fixture rows (3KL also refuses non-`lms_test*` databases), so they were deliberately **not** run against this baseline.

Oracle rows are retained for Phase 5. Do not clean them.

---

# Appendix: column mapping matrix


Oracle VARCHAR2 lengths are BYTE semantics (live check: `NLS_LENGTH_SEMANTICS=BYTE`, `AL32UTF8`).

### 1. users

PK: `id` · UNIQUE: (email), (username)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| email | text | email | VARCHAR2(320) NOT NULL | COPY |
| password_hash | text | password_hash | VARCHAR2(255) NOT NULL | COPY |
| username | text | username | VARCHAR2(255) NOT NULL | COPY |
| display_name | text | display_name | VARCHAR2(1000) NOT NULL | COPY |
| role | text | role | VARCHAR2(20) NOT NULL | COPY |
| password_changed | bool | password_changed | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 2. course_levels

PK: `id` · UNIQUE: (value)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| value | text | level_value | VARCHAR2(255) NOT NULL | RENAME |
| label | text | label | VARCHAR2(1000) NOT NULL | COPY |
| sort_order | int | sort_order | NUMBER(10,0) NOT NULL | COPY |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 3. courses

PK: `id` · FK: instructor_id→users (restrict)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | text | id | VARCHAR2(255) NOT NULL | COPY |
| title | text | title | VARCHAR2(2000) NOT NULL | COPY |
| level | text | course_level | VARCHAR2(255) NOT NULL | RENAME |
| level_label | text | level_label | VARCHAR2(1000) NOT NULL | COPY |
| gradient_class | text | gradient_class | VARCHAR2(255) NOT NULL | COPY |
| instructor_id | uuid | instructor_id | VARCHAR2(36) NOT NULL | COPY |
| is_open | bool | is_open | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| enroll_code | text | enroll_code | VARCHAR2(255) | NULL_POLICY |
| show_scores | bool | show_scores | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| sequential_lessons | bool | sequential_lessons | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| quiz_review_mode | text | quiz_review_mode | VARCHAR2(30) NOT NULL | COPY |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 4. course_enrollments

PK: `id` · FK: course_id→courses (cascade); student_id→users (cascade) · UNIQUE: (course_id,student_id)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| course_id | text | course_id | VARCHAR2(255) NOT NULL | COPY |
| student_id | uuid | student_id | VARCHAR2(36) NOT NULL | COPY |
| progress | int | progress | NUMBER(10,0) NOT NULL | COPY |
| enrolled_at | timestamptz | enrolled_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 5. course_announcements

PK: `id` · FK: course_id→courses (cascade); author_id→users (restrict)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| course_id | text | course_id | VARCHAR2(255) NOT NULL | COPY |
| author_id | uuid | author_id | VARCHAR2(36) NOT NULL | COPY |
| title | text | title | VARCHAR2(2000) NOT NULL | COPY |
| body | text | body | CLOB NOT NULL | EMPTY_CLOB |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 6. chapters

PK: `id` · FK: course_id→courses (cascade)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | text | id | VARCHAR2(255) NOT NULL | COPY |
| course_id | text | course_id | VARCHAR2(255) NOT NULL | COPY |
| title | text | title | VARCHAR2(2000) NOT NULL | COPY |
| sort_order | int | sort_order | NUMBER(10,0) NOT NULL | COPY |
| is_published | bool | is_published | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| is_locked | bool | is_locked | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 7. topics

PK: `id` · FK: chapter_id→chapters (cascade)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | text | id | VARCHAR2(255) NOT NULL | COPY |
| chapter_id | text | chapter_id | VARCHAR2(255) NOT NULL | COPY |
| title | text | title | VARCHAR2(2000) NOT NULL | COPY |
| sort_order | int | sort_order | NUMBER(10,0) NOT NULL | COPY |
| is_published | bool | is_published | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| is_locked | bool | is_locked | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 8. lessons

PK: `id` · FK: topic_id→topics (cascade); course_id→courses (cascade)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | text | id | VARCHAR2(255) NOT NULL | COPY |
| topic_id | text | topic_id | VARCHAR2(255) NOT NULL | COPY |
| course_id | text | course_id | VARCHAR2(255) | NULL_POLICY |
| title | text | title | VARCHAR2(2000) NOT NULL | COPY |
| description | text | description | CLOB NOT NULL | EMPTY_CLOB |
| video_url | text | video_url | VARCHAR2(2048) | NULL_POLICY |
| sort_order | int | sort_order | NUMBER(10,0) NOT NULL | COPY |
| is_published | bool | is_published | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| is_locked | bool | is_locked | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 9. lesson_segments

PK: `id` · FK: lesson_id→lessons (cascade)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | text | id | VARCHAR2(255) NOT NULL | COPY |
| lesson_id | text | lesson_id | VARCHAR2(255) NOT NULL | COPY |
| title | text | title | VARCHAR2(2000) NOT NULL | COPY |
| duration | text | duration | VARCHAR2(20) NOT NULL | COPY |
| sort_order | int | sort_order | NUMBER(10,0) NOT NULL | COPY |

### 10. assignments

PK: `id` · FK: course_id→courses (cascade); lesson_id→lessons (cascade); created_by→users (restrict)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | text | id | VARCHAR2(255) NOT NULL | COPY |
| course_id | text | course_id | VARCHAR2(255) NOT NULL | COPY |
| lesson_id | text | lesson_id | VARCHAR2(255) | NULL_POLICY |
| created_by | uuid | created_by | VARCHAR2(36) NOT NULL | COPY |
| type | text | assignment_type | VARCHAR2(20) NOT NULL | RENAME |
| title | text | title | VARCHAR2(2000) NOT NULL | COPY |
| due_date | date | due_date | DATE NOT NULL | DATE_COPY |
| points | numeric | points | NUMBER(12,4) NOT NULL | NUMERIC_SCALE |
| instructions | text | instructions | CLOB | NULL_POLICY |
| time_limit | int | time_limit | NUMBER(10,0) | COPY |
| show_scores | bool | show_scores | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| quiz_review_mode | text | quiz_review_mode | VARCHAR2(30) NOT NULL | COPY |
| is_open | bool | is_open | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| allow_edit_submission | bool | allow_edit_submission | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| allow_cancel_submission | bool | allow_cancel_submission | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| quiz_attempt_limit | int | quiz_attempt_limit | NUMBER(10,0) | COPY |
| multi_select_scoring_mode | text | multi_select_scoring_mode | VARCHAR2(30) NOT NULL | COPY |
| open_at | timestamptz | open_at | TIMESTAMP WITH TIME ZONE | TIMESTAMP_TRANSFORM |
| close_at | timestamptz | close_at | TIMESTAMP WITH TIME ZONE | TIMESTAMP_TRANSFORM |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 11. quiz_questions

PK: `id` · FK: assignment_id→assignments (cascade)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| assignment_id | text | assignment_id | VARCHAR2(255) NOT NULL | COPY |
| question_text | text | question_text | CLOB NOT NULL | COPY |
| question_type | text | question_type | VARCHAR2(30) NOT NULL | COPY |
| options | jsonb | options | CLOB (IS JSON) NOT NULL | JSON_SERIALIZE |
| correct_index | int | correct_index | NUMBER(10,0) | COPY |
| correct_indices | jsonb | correct_indices | CLOB (IS JSON) | JSON_SERIALIZE |
| correct_answer | text | correct_answer | CLOB | NULL_POLICY |
| matching_pairs | jsonb | matching_pairs | CLOB (IS JSON) | JSON_SERIALIZE |
| explanation | text | explanation | CLOB NOT NULL | EMPTY_CLOB |
| points | numeric | points | NUMBER(12,4) NOT NULL | NUMERIC_SCALE |
| is_required | bool | is_required | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| sort_order | int | sort_order | NUMBER(10,0) NOT NULL | COPY |

### 12. submissions

PK: `id` · FK: assignment_id→assignments (cascade); student_id→users (cascade)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| assignment_id | text | assignment_id | VARCHAR2(255) NOT NULL | COPY |
| student_id | uuid | student_id | VARCHAR2(36) NOT NULL | COPY |
| type | text | submission_type | VARCHAR2(20) NOT NULL | RENAME |
| file_name | text | file_name | VARCHAR2(2000) | NULL_POLICY |
| file_path | text | file_path | VARCHAR2(4000) | NULL_POLICY |
| score | numeric | score | NUMBER(12,4) | NUMERIC_SCALE |
| previous_score | numeric | previous_score | NUMBER(12,4) | NUMERIC_SCALE |
| question_scores | jsonb | question_scores | CLOB (IS JSON) | JSON_SERIALIZE |
| answers | jsonb | answers | CLOB (IS JSON) | JSON_SERIALIZE |
| is_manually_graded | bool | is_manually_graded | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| submitted_at | timestamptz | submitted_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 13. meetings

PK: `id` · FK: created_by→users (restrict)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | text | id | VARCHAR2(255) NOT NULL | COPY |
| created_by | uuid | created_by | VARCHAR2(36) NOT NULL | COPY |
| subject | text | subject | VARCHAR2(2000) NOT NULL | COPY |
| join_url | text | join_url | VARCHAR2(2048) NOT NULL | COPY |
| start_datetime | timestamptz | start_datetime | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| end_datetime | timestamptz | end_datetime | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| passcode | text | passcode | VARCHAR2(255) NOT NULL | COPY |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 14. teacher_private_lesson_availability

PK: `teacher_id, weekday` · FK: teacher_id→users (cascade)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| teacher_id | uuid | teacher_id | VARCHAR2(36) NOT NULL | COPY |
| weekday | smallint | weekday | NUMBER(10,0) NOT NULL | COPY |
| is_available | bool | is_available | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| start_time | time | start_time | VARCHAR2(5) NOT NULL | TIME_STRING |
| end_time | time | end_time | VARCHAR2(5) NOT NULL | TIME_STRING |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 15. student_lesson_completions

PK: `id` · FK: student_id→users (cascade); lesson_id→lessons (cascade) · UNIQUE: (student_id,lesson_id)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| student_id | uuid | student_id | VARCHAR2(36) NOT NULL | COPY |
| lesson_id | text | lesson_id | VARCHAR2(255) NOT NULL | COPY |
| completed_at | timestamptz | completed_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 16. live_classes

PK: `id` · FK: course_id→courses (cascade); lesson_id→lessons (set null); host_id→users (cascade) · UNIQUE: (room_name)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| course_id | text | course_id | VARCHAR2(255) NOT NULL | COPY |
| lesson_id | text | lesson_id | VARCHAR2(255) | NULL_POLICY |
| room_name | text | room_name | VARCHAR2(255) NOT NULL | COPY |
| title | text | title | VARCHAR2(2000) NOT NULL | COPY |
| description | text | description | CLOB | NULL_POLICY |
| scheduled_at | timestamptz | scheduled_at | TIMESTAMP WITH TIME ZONE | TIMESTAMP_TRANSFORM |
| duration_minutes | int | duration_minutes | NUMBER(10,0) | COPY |
| host_id | uuid | host_id | VARCHAR2(36) NOT NULL | COPY |
| is_active | bool | is_active | NUMBER(1,0) | BOOLEAN_TRANSFORM |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 17. live_class_participants

PK: `id` · FK: live_class_id→live_classes (cascade); user_id→users (cascade) · UNIQUE: (live_class_id,user_id)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| live_class_id | uuid | live_class_id | VARCHAR2(36) NOT NULL | COPY |
| user_id | uuid | user_id | VARCHAR2(36) NOT NULL | COPY |
| joined_at | timestamptz | joined_at | TIMESTAMP WITH TIME ZONE | TIMESTAMP_TRANSFORM |
| left_at | timestamptz | left_at | TIMESTAMP WITH TIME ZONE | TIMESTAMP_TRANSFORM |
| duration_seconds | int | duration_seconds | NUMBER(10,0) | COPY |

### 18. private_lesson_requests

PK: `id` · FK: student_id→users (cascade); teacher_id→users (cascade); course_id→courses (cascade); live_class_id→live_classes (set null)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| id | uuid | id | VARCHAR2(36) NOT NULL | COPY |
| student_id | uuid | student_id | VARCHAR2(36) NOT NULL | COPY |
| teacher_id | uuid | teacher_id | VARCHAR2(36) NOT NULL | COPY |
| course_id | text | course_id | VARCHAR2(255) NOT NULL | COPY |
| requested_at | timestamptz | requested_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| requested_slots | jsonb | requested_slots | CLOB (IS JSON) NOT NULL | JSON_SERIALIZE |
| confirmed_at | timestamptz | confirmed_at | TIMESTAMP WITH TIME ZONE | TIMESTAMP_TRANSFORM |
| duration_minutes | int | duration_minutes | NUMBER(10,0) NOT NULL | COPY |
| message | text | message | CLOB NOT NULL | EMPTY_CLOB |
| teacher_note | text | teacher_note | CLOB | NULL_POLICY |
| status | text | status | VARCHAR2(20) NOT NULL | COPY |
| live_class_id | uuid | live_class_id | VARCHAR2(36) | COPY |
| created_at | timestamptz | created_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

### 19. lesson_live_broadcasts

PK: `lesson_id` · FK: lesson_id→lessons (cascade); started_by→users (set null)

| Source column | Source type | Oracle column | Oracle type | Class |
|---|---|---|---|---|
| lesson_id | text | lesson_id | VARCHAR2(255) NOT NULL | COPY |
| is_live | bool | is_live | NUMBER(1,0) NOT NULL | BOOLEAN_TRANSFORM |
| youtube_video_id | text | youtube_video_id | VARCHAR2(255) | NULL_POLICY |
| started_by | uuid | started_by | VARCHAR2(36) | COPY |
| started_at | timestamptz | started_at | TIMESTAMP WITH TIME ZONE | TIMESTAMP_TRANSFORM |
| ended_at | timestamptz | ended_at | TIMESTAMP WITH TIME ZONE | TIMESTAMP_TRANSFORM |
| updated_at | timestamptz | updated_at | TIMESTAMP WITH TIME ZONE NOT NULL | TIMESTAMP_TRANSFORM |

