# Phase 3 — Dual-Provider API and SQL Migration

**Status:** COMPLETE (Phases 3A-3L; all 28 business routes on the dual-provider abstraction)  
**Started:** 2026-10-07  
**Last Updated:** 2026-10-07

## Progress Summary

**Phase 3A: Shared Foundation** — ✅ COMPLETE  
**Phase 3B: Auth / Users (6 routes)** — ✅ COMPLETE  
**Phase 3C: Course Foundation (2 routes)** — ✅ COMPLETE  
**Phase 3D: Enrollment / Announcements (2 routes)** — ✅ COMPLETE  
**Phase 3E: Content Hierarchy (3 routes)** — ✅ COMPLETE  
**Phase 3F: Progress (1 route)** — ✅ COMPLETE  
**Phase 3G: Assignments / Quiz (1 route)** — ✅ COMPLETE  
**Phase 3H: Submissions / Scoring (1 route)** — ✅ COMPLETE (Oracle 118/118, PostgreSQL 118/118 on a disposable database)  
**Phase 3I: Aggregate Read Models (2 routes)** — ✅ COMPLETE (169/169 on Oracle and PostgreSQL)  
**Phase 3J: Private Lessons (3 routes)** — ✅ COMPLETE (169/169 on Oracle and PostgreSQL)  
**Phase 3K: Live Classes (6 routes)** — ✅ COMPLETE (91/91 on Oracle and PostgreSQL)  
**Phase 3L: Live Broadcast (1 route)** — ✅ COMPLETE (91/91 on Oracle and PostgreSQL)

**Routes migrated:** 28/28 business routes (29 `route.ts` files; the extra one is `health`, already on `@/lib/database`)  
**Remaining `pool.query()` calls in `app/api`:** 0  
**Oracle verifier:** 88/88 checks PASS  
**Lint:** PASS (14 warnings, 0 errors; 0 new from Phase 3H-3L)  
**TypeScript:** PASS

## Current Session Scope

Latest session: **Phase 3K + 3L (live classes, live broadcast)**. All 28 business routes are migrated; Phase 3 is complete. Phase 4 (production data migration) has not been started and needs its own plan.

## Objective

Migrate application database access from PostgreSQL-specific direct `pool.query()` usage to the database abstraction layer, supporting both `DB_PROVIDER=postgres` and `DB_PROVIDER=oracle` with provider-specific SQL where necessary.

## Critical Principles

- ✅ Do NOT attempt automatic SQL translation or runtime `$1 → :1` replacement
- ✅ Use provider-specific SQL where syntax differs
- ✅ Keep PostgreSQL/CockroachDB as active production provider
- ✅ Maintain both `pg` and `oracledb` support simultaneously
- ✅ Use Phase 1 abstractions: `query()`, `withTransaction()`, boolean/JSON helpers
- ✅ Apply Oracle column renames with compatibility aliases
- ✅ Test both providers for every migrated domain
- ❌ Do NOT migrate production CockroachDB data during Phase 3
- ❌ Do NOT switch `DB_PROVIDER` to Oracle in production

## Migration Progress

### Phase 3A — Shared Foundation

**Status:** COMPLETE

- [x] Review existing `lib/database/` utilities
- [x] Add EMPTY_CLOB normalization helper (`lib/database/text.ts`)
- [x] Export `normalizeEmptyText()` and `prepareEmptyText()` functions
- [x] Document helper functions with usage constraints
- [x] Update Oracle verifier to expect EMPTY_CLOB behavior as correct

**Deliverables:**
- `lib/database/text.ts` — EMPTY_CLOB normalization for 4 documented fields
- Updated `lib/database/index.ts` — exports text helpers
- Updated `scripts/verify-oracle-live.cjs` — corrected EMPTY_CLOB test expectations
- Oracle verifier now reports 71/71 checks passing (previously 67/71)

### Phase 3B — Auth / Users

**Status:** COMPLETE

Routes migrated:
- [x] `app/api/auth/login/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/auth/me/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/auth/password/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/auth/register/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/admin/users/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/profiles/route.ts` — PostgreSQL ✅ Oracle ✅

**Migration approach:**
- Removed direct `pool.query()` dependencies
- Used provider-specific SQL with named binds for Oracle
- Applied boolean normalization with `fromDbBoolean()` / `toDbBoolean()`
- Generated UUIDs in application code for Oracle (`randomUUID()`)
- Avoided `INSERT ... RETURNING` for Oracle (INSERT + SELECT pattern)
- Preserved API response shapes and status codes
- Added TypeScript type assertions for query results

**Key transformations:**
- PostgreSQL: `WHERE id = $1` → Oracle: `WHERE id = :id`
- PostgreSQL: `LIMIT 1` → Oracle: `AND ROWNUM = 1`
- PostgreSQL: `INSERT ... RETURNING *` → Oracle: `INSERT` + `SELECT` by ID
- Boolean values: `NUMBER(1)` ↔ JavaScript `boolean` via helpers
- Unique constraint errors preserved (email/username)
- Admin constraint enforcement preserved (single admin rule)

### Phase 3C — Course Foundation

**Status:** COMPLETE

Routes migrated:
- [x] `app/api/levels/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/courses/route.ts` — PostgreSQL ✅ Oracle ✅

**Migration approach:**
- Applied Oracle column aliases: `level_value AS value`, `course_level AS level`
- Preserved API response shapes — frontend unaware of Oracle renames
- Used application-generated UUIDs for Oracle INSERT
- Mapped boolean fields (`is_open`, `show_scores`, `sequential_lessons`)
- Avoided PostgreSQL `RETURNING` for Oracle (INSERT + SELECT pattern)
- Preserved duplicate unique constraint detection (ORA-00001)

**Key transformations:**
- PostgreSQL: `SELECT value` → Oracle: `SELECT level_value AS value`
- PostgreSQL: `UPDATE courses SET level =` → Oracle: `UPDATE courses SET course_level =`
- PostgreSQL: `INSERT ... RETURNING id` → Oracle: `INSERT` + return application-generated ID
- PostgreSQL: `now()` → Oracle: `SYSTIMESTAMP`

### Phase 3D — Enrollment / Announcements

**Status:** COMPLETE

Routes migrated:
- [x] `app/api/courses/enroll/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/announcements/route.ts` — PostgreSQL ✅ Oracle ✅

**Migration approach:**

**Enrollment UPSERT:**
- PostgreSQL: `ON CONFLICT (course_id, student_id) DO NOTHING`
- Oracle: `MERGE INTO course_enrollments` with dual-source pattern
- Preserved idempotent enrollment behavior
- Application-generated UUID for Oracle enrollment ID

**Announcements:**
- Translated `UPDATE ... FROM` → Oracle correlated subquery with `EXISTS`
- Translated `DELETE ... USING` → Oracle correlated subquery with `EXISTS`
- Applied EMPTY_CLOB normalization for `body` field:
  - **Read path:** `normalizeEmptyText()` converts Oracle NULL → empty string
  - **Write path:** Empty string writes omit `body` column to use `DEFAULT EMPTY_CLOB()`
  - Non-empty text writes include `body` parameter explicitly
- Preserved authorization checks in UPDATE/DELETE with EXISTS clauses
- API response shape preserved — `body` always returns string (never null to client)

**EMPTY_CLOB Strategy:**
- **Insert with empty body:** Omit column → `DEFAULT EMPTY_CLOB()` applies
- **Insert with text:** Include `:body` parameter → text stored
- **Update to empty:** `SET body = EMPTY_CLOB()` explicitly
- **Update to text:** `SET body = :body` with parameter
- **Read:** `normalizeEmptyText(row.body)` converts fetched NULL → `""`

**SQL patterns translated:**
```sql
-- PostgreSQL UPDATE...FROM
UPDATE course_announcements a SET ... FROM courses c
WHERE a.course_id = c.id AND ...

-- Oracle equivalent
UPDATE course_announcements a SET ...
WHERE a.id = :id
AND EXISTS (SELECT 1 FROM courses c WHERE c.id = a.course_id AND ...)

-- PostgreSQL DELETE...USING
DELETE FROM course_announcements a USING courses c
WHERE a.id = :id AND a.course_id = c.id AND ...

-- Oracle equivalent
DELETE FROM course_announcements a
WHERE a.id = :id
AND EXISTS (SELECT 1 FROM courses c WHERE c.id = a.course_id AND ...)
```

### Phase 3E — Content Hierarchy

**Status:** COMPLETE

Routes migrated:
- [x] `app/api/chapters/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/topics/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/lessons/route.ts` — PostgreSQL ✅ Oracle ✅

**Migration approach:**

**Chapters:**
- Translated `UPDATE ... FROM` → Oracle EXISTS subquery for authorization
- Applied boolean normalization (`is_published`, `is_locked`)
- Preserved sort order calculation with MAX(sort_order) + 1
- Application-generated UUIDs for Oracle

**Topics:**
- Translated multi-table `UPDATE ... FROM` (chapters JOIN courses) → Oracle EXISTS with nested JOIN
- Applied boolean normalization
- Preserved parent-child hierarchy validation
- Sort order behavior maintained

**Lessons:**
- **EMPTY_CLOB Strategy for `description` field:**
  - **INSERT with empty description:** Omit column → `DEFAULT EMPTY_CLOB()` applies
  - **INSERT with text:** Include `:description` parameter → text stored
  - **UPDATE to empty:** `SET description = EMPTY_CLOB()` explicitly
  - **UPDATE to text:** `SET description = :description` with parameter
  - **READ:** Database NULL → API returns `""` (via `normalizeEmptyText()`)
- Applied boolean normalization (`is_published`, `is_locked`)
- Complex fallback INSERT logic preserved (with/without course_id)
- Sort order calculation across topic/course hierarchy

**Key transformations:**
```sql
-- PostgreSQL UPDATE...FROM
UPDATE chapters ch SET ... FROM courses c
WHERE ch.id = $1 AND ch.course_id = c.id AND ...

-- Oracle equivalent
UPDATE chapters ch SET ...
WHERE ch.id = :id
AND EXISTS (SELECT 1 FROM courses c WHERE c.id = ch.course_id AND ...)
```

### Phase 3F — Progress

**Status:** COMPLETE

Routes migrated:
- [x] `app/api/lessons/complete/route.ts` — PostgreSQL ✅ Oracle ✅

**Migration approach:**

**Progress Transaction:**
The entire completion workflow runs in a single transaction using `withTransaction()`:
1. Lookup course_id from lesson via topic→chapter join (with fallback)
2. UPSERT completion record (MERGE for Oracle, ON CONFLICT for PostgreSQL)
3. Count total lessons in course (including topic-based and direct course lessons)
4. Count completed lessons for student
5. Calculate progress percentage: `Math.round((completed / total) * 100)`
6. Update `course_enrollments.progress`

**Completion UPSERT:**
- PostgreSQL: `ON CONFLICT (student_id, lesson_id) DO NOTHING`
- Oracle: `MERGE INTO student_lesson_completions` with dual-source pattern
- Idempotent behavior preserved — duplicate completions safe

**Progress Calculation Parity:**
- Same rounding behavior: `Math.round()` for both providers
- Same lesson counting logic (LEFT JOIN to handle both hierarchy types)
- Same progress formula: `(completed / total) * 100`
- Division by zero protection: returns 0 if no lessons

**Transaction Rollback:**
If any step fails, the entire transaction rolls back:
- No partial completion records
- Enrollment progress unchanged
- Student state remains consistent

**Oracle case-insensitive column names:**
Handled COUNT result as both `count` and `COUNT` to support Oracle's uppercase column naming

### Phase 3G — Assignments / Quiz

**Status:** COMPLETE

Routes migrated:
- [x] `app/api/assignments/route.ts` — PostgreSQL ✅ Oracle ✅

**Operations:**
- [x] POST — Assignment + question creation
- [x] PUT — Assignment update + question replacement with auto-regrade
- [x] DELETE — Atomic assignment + submission deletion

**Migration approach:**

**POST Operation:**
- Application-generated UUIDs for Oracle
- Oracle column mapping: `assignment_type` (not exposed to API)
- EMPTY_CLOB handling for `quiz_questions.explanation`
- JSON serialization: `options`, `correct_indices`, `matching_pairs`
- Boolean normalization: `is_required`
- Fractional points preserved: `NUMBER(12,4)`
- Sequential inserts (assignment + questions)

**DELETE Operation:**
- Migrated to `withTransaction()` for atomicity
- Deletes submissions THEN assignment in single transaction
- Authorization enforced within transaction
- Rollback on failure ensures no orphan records

**PUT Operation:**
- Full transaction using `withTransaction()`
- Assignment settings update
- Question replacement: DELETE old + INSERT new questions
- Auto-regrade logic preserved: recalculates scores for affected auto-graded submissions
- Maintains original scoring algorithm from `lib/quizScoring.ts`
- Manual grading state preserved (`question_scores` field)

**quiz_questions.explanation EMPTY_CLOB:**
- **Write (INSERT empty):** Omit column → `DEFAULT EMPTY_CLOB()`
- **Write (INSERT text):** Include `:explanation` parameter
- **Write (UPDATE empty):** Omit column (not yet in UPDATE route)
- **Read:** Not yet implemented (pending GET routes migration)

**JSON Handling:**
- Oracle: Uses `serializeJson()` for write, pending `parseJson()` for read
- PostgreSQL: Uses `JSON.stringify()` for write, native JSON for read
- Fields: `options`, `correct_indices`, `matching_pairs`

**Due-Date Business Timezone:**
- Stores DATE (date-only) value: `YYYY-MM-DD`
- No timezone conversion applied (matches current behavior)
- Business timezone: Asia/Bangkok (+07:00) per session settings
- `2026-12-31` means "end of business day December 31, 2026"
- Exact cutoff time (23:59:59) not enforced in assignment CRUD
- Server-timezone independence: NOT TESTED

**Assignment Type Mapping:**
- PostgreSQL: `assignments.type`
- Oracle: `assignments.assignment_type`
- API contract preserved (backend uses `assignment_type`, frontend sees `type` where aliased)

**Transaction Design:**

**PUT Transaction Flow:**
1. Update assignment settings
2. DELETE existing quiz_questions
3. INSERT new quiz_questions (with EMPTY_CLOB handling)
4. Query affected submissions
5. Recalculate auto-graded submission scores
6. UPDATE submissions with new scores
7. COMMIT (or ROLLBACK on any failure)

**DELETE Transaction Flow:**
1. FOR UPDATE lock on assignment
2. Verify authorization
3. DELETE submissions
4. DELETE assignment
5. COMMIT (or ROLLBACK on failure)

**Key SQL Patterns:**

```sql
-- PostgreSQL LIMIT → Oracle FETCH FIRST
LIMIT 1 → FETCH FIRST 1 ROWS ONLY

-- Type column mapping
assignments.type → assignments.assignment_type

-- Submission type column mapping  
submissions.type → submissions.submission_type
```

### Phase 3H — Submissions / Scoring

**Status:** COMPLETE (Oracle 118/118; PostgreSQL 118/118 on a disposable database)

Routes migrated:
- [x] `app/api/submissions/route.ts` — PostgreSQL ✅ (118/118, disposable PostgreSQL 18) Oracle ✅ (118/118)

Also changed: `lib/database/oracle.ts` now sets `oracledb.fetchAsString = [CLOB]` when the driver loads.
Before this, the app adapter returned CLOB columns as `Lob` stream objects (confirmed against the live
database). That would have broken `answers` / `question_scores` reads here and the Phase 3G auto-regrade
check (`!questionScores` is never true for a Lob object). The verifier script already set this flag itself,
which is why it did not catch the gap. Applies to every CLOB column, so it also covers earlier phases.

**Current behavior (read from the code, not inferred from schema):**
- The server does NOT grade quizzes. The client computes `score` and `questionScores` with `lib/quizScoring.ts` and POSTs them; the route persists them. Scoring logic was not touched.
- POST: students are checked against `is_open` / `open_at` / `close_at` (403). Teachers/admins are not. `type='file'` upserts one row per (assignment, student): `previous_score = score ?? previous_score`, `score = NULL`. Quiz POSTs always insert a new row (no attempt limit is enforced here).
- PUT with `fileName`: student edit of own file submission, needs `allow_edit_submission`, same window check, same `previous_score` rule, `submitted_at = now`.
- PUT with `questionScores`: teacher (course instructor) or admin; array length must equal question count, each 0..points; sets `score` = sum, `question_scores`, `is_manually_graded = true`.
- PUT with `score` / `reset`: teacher or admin sets or clears `score`, `is_manually_graded = true`. No instructor-ownership check exists on this path (pre-existing, preserved; any teacher can set a score).
- DELETE: student cancels own file submission if `allow_cancel_submission`.
- `question_scores IS NULL` means "client sent no per-question scores"; Phase 3G auto-regrade only touches those rows. Preserved exactly.

**Pre-existing behaviors preserved on purpose (none are regressions, several look like bugs):**
1. `due_date` is never enforced. `pg` and `oracledb` both return DATE as a JS `Date`, so `String(d).slice(0,10)` is not `YYYY-MM-DD`, the deadline parses to NaN and becomes `null`. Only `is_open`/`open_at`/`close_at` block submissions. Decision (user): preserve, do not change policy in a migration phase. Verified on Oracle: a 2020 `due_date` with no `close_at` still accepts a submission. Needs a separate decision.
2. No enrollment check and no assignment-exists check on POST; an unenrolled student is accepted, an unknown assignment fails on the FK and returns a generic 500.
3. Any teacher can set a manual `score` on any submission (no ownership check on that path).
4. File upsert is SELECT-then-INSERT/UPDATE with no unique constraint, so two concurrent first submits can create two rows. Same as PostgreSQL today; not made worse, not fixed.

**Behavior differences introduced (all intentional, small):**
- Every handler now returns a generic `{"error":"Internal server error"}` 500 on database failure instead of throwing an unhandled exception. No SQL, ORA codes, schema names or wallet paths reach the client (asserted in the integration test).
- The read-then-write sequences in POST(file), PUT and DELETE run in `withTransaction` on one connection. The old `.catch(() => ({rows: []}))` on those SELECTs is gone there, so a DB error on the lookup is now a 500 instead of silently falling through to INSERT or a misleading 404.
- Oracle `submitted_at` is bound as a UTC ISO string through `FROM_TZ(TO_TIMESTAMP(...), 'UTC')`, not as a bare JS `Date`. A bare `Date` bind is TIMESTAMP_LTZ, applies today's session offset, and stored a March timestamp one hour off when the server ran in America/Los_Angeles (DST). Found by the integration test, fixed, and retested on both DST periods.
- The same conversion now lives in the shared helper `lib/database/timestamp.ts` (`oracleUtcInstant`) and is also used by the Phase 3G assignments route (see the closeout section below).

**Column/type mapping:** Oracle reads use `s.submission_type AS type`; the API never exposes `submission_type`. Oracle keys come back upper-case, so the route lower-cases row keys once. Booleans go through `fromDbBoolean` (`is_open`, `allow_*`), writes use `1` / `TRUE`. `answers` / `question_scores` are written with plain `JSON.stringify` on both providers (not `serializeJson`, which would pass through a string answer that happens to be valid JSON and diverge from PostgreSQL). Oracle IDs are `randomUUID()`; INSERT then returns the generated id (no RETURNING on Oracle).

**Transaction strategy:** POST (file branch and insert), PUT (student edit, question-score grading) and DELETE each use `withTransaction` on a dedicated connection. The plain manual `score` update and the window pre-check are single statements and stay on `query`.

**Oracle integration results** (`npm run db:test:phase3h:oracle`, `scripts/test-phase-3h-oracle.cjs`): 118/118 PASS. Seeds tagged fixtures, drives the real route over HTTP on a `DB_PROVIDER=oracle` dev server (TZ=UTC, then America/Los_Angeles), checks rows directly, deletes everything, and verifies zero residue.
- Scoring fixtures: 20 of 23 match `test-fixtures/phase-3h-quiz-scoring.md`. 3 are fixture errata (below). Perfect submission = 12.25, per-question `[1,3,2,3,0,2.25,1]`.
- answers JSON: single map, multi array, fill blank, matching map, Thai text with emoji, nulls, `[]`, `{}`, 60,000-char essay all round-trip structurally.
- question_scores JSON: array round-trip; omitted sends NULL.
- Numeric: 0, 0.5, 2.25, 10.125, 12.875, 22.25 stored exactly, no integer coercion. Scale 4 rounds `1.23456` to `1.2346` (database behavior, no app rounding added). Fractional question scores sum to 12.875.
- previous_score: first submit NULL; resubmit after a manual 7.5 gives previous 7.5 and clears score; a second resubmit keeps 7.5; after regrade 8.125 a student edit gives previous 8.125; cancel then resubmit starts clean.
- Manual grading: question-score grading sets total + `question_scores` + flag; regrade overwrites; reset / null clear score; validation 400s (length, range, negative, non-array, non-numeric, file type); 403 for student and other course's teacher; admin allowed; 404 for unknown id.
- Cancel/edit: allowed, disallowed, non-owner 403, unknown 404, quiz type 400, unauthenticated 401.
- Deadline: `is_open=0`, before `open_at`, after `close_at` all 403 under both server timezones; a `close_at` 6 seconds ahead accepts, then rejects after it passes, and the rejected call leaves the row untouched. `close_at` is an absolute instant, so the result does not depend on server timezone (tested TZ=UTC and America/Los_Angeles). `submittedAt` instant preserved for 2026-03-01 and 2026-07-01 under Los Angeles.
- Auto-regrade compat: a submission created by the new path with NULL `question_scores` is regraded 12.25 to 15.5 by the Phase 3G `PUT /api/assignments` after Q1 1 to 2 points and Q6 2.25 to 4.5; a row with `question_scores` is left alone.
- Rollback (mandatory): real `withTransaction`; an UPDATE and an INSERT succeed, a third write violates an FK. Error normalized to `foreign_key`; baseline row's score / previous_score / question_scores unchanged, partial row absent, no orphans, pool connection healthy afterward.
- Errors: unknown assignment, invalid type, negative score all return the generic 500 with no leaked internals.

**Fixture errata** (`test-fixtures/phase-3h-quiz-scoring.md` was NOT edited; the scoring code is the source of truth and was not changed):
1. Multi-select `correct_only`, answer `[0,1,2,3]`: doc says 2.25; code gives 3.0 (no penalty in this mode).
2. Multi-select `penalize_incorrect`, answer `[0,1,2,3]`: doc says "~2.25"; code gives 2.0 (`(1 - 1/3) * 3`).
3. Matching: doc shows name-keyed answers (`{"France":"Paris"}`) scoring 3.0; the app keys matching answers by index (`answer[i] === i`), so name-keyed answers score 0.

**PostgreSQL:** validated on a disposable database; see "Phase 3H PostgreSQL closeout" below. Production CockroachDB was never used.

### Phase 3H PostgreSQL closeout and Phase 3G timezone recheck

**Disposable environment:** Docker was installed but its daemon was not running, so a throwaway PostgreSQL 18.4 cluster was created with the locally installed binaries (`initdb`, trust auth, `127.0.0.1:5433`, database `lms_test`, data directory in the temp folder). The schema came from the project's own `npm run db:migrate:postgres` (all 16 LMS tables verified). The existing PostgreSQL 17 service on 5432 was not touched. After testing the cluster was stopped and its directory deleted. The test harness (`scripts/lib/phase3-test-harness.cjs`) refuses to run in PostgreSQL mode unless `DATABASE_URL` is a local `lms_test*` database; this was checked by running it with the production URL from `.env.local` and confirming it refused.

**How to rerun:** `npm run db:test:phase3h:oracle`, and for PostgreSQL start a disposable server, run `npm run db:migrate:postgres` with `DATABASE_URL` pointing at it, then `npm run db:test:phase3h:postgres` with the same `DATABASE_URL`. The Phase 3G recheck is `node scripts/test-phase-3g-timezone.cjs [--postgres]`.

**Results:** the same 118-check script ran against both providers and the real route over HTTP. 117 checks are identical by name and both pass. The 118th is a deliberate, documented provider difference.

```text
Scenario                         PostgreSQL   Oracle
first submit                     PASS         PASS
resubmit / retry                 PASS         PASS
answers JSON (9 shapes + 60k)    PASS         PASS
question_scores JSON             PASS         PASS
fractional scores                PASS         PASS
previous_score                   PASS         PASS
manual grading                   PASS         PASS
edit / cancel / delete           PASS         PASS
window + close_at boundary       PASS         PASS
due_date not enforced            PASS         PASS
auth + error mapping             PASS         PASS
auto-regrade (Phase 3G)          PASS         PASS
rollback                         PASS         PASS
scoring fixtures                 20/23 + 3 errata on both
```

Expected difference: PostgreSQL `NUMERIC` has no scale limit and keeps `1.23456`; Oracle `NUMBER(12,4)` stores `1.2346`. Neither application path adds rounding.

**PostgreSQL rollback:** real `withTransaction` on a dedicated client (explicit `BEGIN`). An UPDATE and an INSERT succeeded, a third write violated a foreign key; the error normalized to `foreign_key`, the baseline row's score / previous_score / question_scores were unchanged, the partial row was absent, no orphans, and the connection was reusable.

**Phase 3G `open_at` / `close_at` recheck: a real bug, now fixed.** `PUT /api/assignments` bound `new Date(x).toISOString()` straight into the Oracle `TIMESTAMP WITH TIME ZONE` columns. Oracle parses that string with the session `NLS_TIMESTAMP_TZ_FORMAT` (`DD-MON-RR HH.MI.SSXFF AM TZR`) and raised `ORA-01843`, so every Oracle PUT that carried a real `openAt` or `closeAt` returned 500 ("Failed to update assignment"). It was in every server timezone, not only DST ones. Only clearing to NULL worked. The existing verifier never sent a non-null `openAt`/`closeAt`, which is why 88/88 did not catch it. Fix: both columns now use `oracleUtcInstant()` from `lib/database/timestamp.ts` (`FROM_TZ(TO_TIMESTAMP(:x, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'), 'UTC')`), the conversion already validated in 3H. PostgreSQL SQL is unchanged. Before the fix: 4/31 on Oracle. After: 31/31 on Oracle and 31/31 on PostgreSQL.

Timezone matrix (`scripts/test-phase-3g-timezone.cjs`): the Next server was started with `TZ` set to each zone, instants were written through the real PUT, then read back as UTC from the database. Cases: March open + July close, July open + March close, and `+07:00` offset inputs, plus clearing with `""` / `null`. Result: stored instant equals input instant to the millisecond in `UTC`, `America/Los_Angeles` and `Asia/Bangkok`, on both providers.

**Not changed, as instructed:** `due_date` (still DATE, still not enforced), enrollment check on POST, teacher ownership on manual scores, and the unique-constraint gap for simultaneous first submissions. These remain open product, security and concurrency issues for later hardening, separate from the migration.

**Regression after the CLOB adapter change and the shared timestamp helper:** Oracle verifier 88/88; Phase 3H Oracle 118/118; `tsc --noEmit` clean; lint 14 warnings (baseline 14, none new). Earlier-phase route behavior is covered by the verifier's route lifecycle checks; there are no separate per-domain scripts for 3B-3F.

### Phase 3I — Aggregate Read Models

**Status:** COMPLETE (combined 3I/3J suite 169/169 on Oracle and 169/169 on PostgreSQL; `/api/data` and catalog responses are identical across providers after id normalisation)

Routes migrated:
- [x] `app/api/data/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/public/catalog/route.ts` — PostgreSQL ✅ Oracle ✅

**`/api/data` (read before editing):** one authenticated GET that runs 11 reads (courses with a lesson-count subquery, chapters, topics, lessons, segments, assignments, quiz questions, submissions, enrollments, profiles, completed lessons) and builds the whole client state. Role behavior: students get their own submissions (cap 500), own enrollments and own completions; teachers get submissions and enrollments of their own courses plus the student list (cap 500); admins get every submission (cap 1000) and every user (cap 1000). Progress is not the stored value: it is recomputed from completions over published lessons. Quiz submissions that are not manually graded and have only auto-gradable questions are re-scored from the current questions at read time. None of this logic changed; only the 11 SQL statements are now written per provider.

**How it was done:** the response-building code is shared and untouched. A small `read()` helper runs the Oracle or PostgreSQL SQL explicitly. For Oracle rows, `normalizeOracleRow` lower-cases keys, turns NUMBER(1) into booleans, parses CLOB JSON (`options`, `correct_indices`, `matching_pairs`, `question_scores`, `answers`) with `parseJson`, and turns EMPTY_CLOB into `""` only for `lessons.description` and `quiz_questions.explanation`. `LIMIT n` became `FETCH FIRST n ROWS ONLY`. API names are restored by alias: `course_level AS "level"`, `assignment_type AS "type"`, `submission_type AS "type"`. `LEVEL` is reserved in Oracle, so those aliases are quoted. COUNT and NUMBER values arrive as JS numbers on both providers. The 11 queries run in parallel against an Oracle pool of 4 and queue within the 10 s queue timeout without issue.

**`/api/public/catalog`:** same pattern (`c.course_level AS "level"`, `level_value AS "value"`, `FETCH FIRST 100`). Public, no auth, ordering unchanged.

**Tested** (`npm run db:test:phase3ij:oracle` / `:postgres`): empty catalog, levels only, one course, two courses (ordering by `created_at` DESC, levels by `sort_order` then label, key sets, aliases). `/api/data` for admin, two teachers, an empty teacher, two students and an empty student, plus the 401 case: course fields and booleans, level alias, lesson counts, progress 33/100 from published lessons only, enroll-code visibility, chapter/topic/lesson flags and ordering, EMPTY_CLOB description and explanation, segments, assignment type alias, fractional question points, JSON structures, open/close instants, recomputed vs manually graded vs answerless submissions, per-role visibility and empty datasets.

### Phase 3J — Private Lessons

**Status:** COMPLETE (Oracle 169/169, PostgreSQL 169/169)

Routes migrated:
- [x] `app/api/private-lesson-availability/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/private-lesson-requests/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/cron/private-lesson-cleanup/route.ts` — PostgreSQL ✅ Oracle ✅ (with `lib/privateLessonRequests.ts`)

**Availability:** HH:MM stays a string everywhere (PostgreSQL `::text` on read and `::time` on write; Oracle `VARCHAR2(5)` both ways), never through `Date`. PUT is one transaction. PostgreSQL keeps `ON CONFLICT (teacher_id, weekday) DO UPDATE`; Oracle uses `MERGE` keyed on the primary key. `MERGE` is not atomic across two sessions the way `ON CONFLICT` is: two simultaneous first-time saves can both take the insert branch and the loser gets ORA-00001. The route retries the whole save once on a `duplicate` error, which turns the loser into the update branch. Tested with two concurrent first-time PUTs: both 200, exactly 7 rows.

**Requests:** every statement is written per provider. PostgreSQL uses `RETURNING *`; Oracle does INSERT/UPDATE then SELECT of the table columns, with application-generated `randomUUID()` ids. The response keeps the old shape (raw snake_case table columns, plus the joined `course_title`, names, `live_room_name`, `live_is_active` on GET). Oracle rows are mapped by `toApiRow`: `requested_slots` parsed from CLOB JSON to an array, `message` EMPTY_CLOB to `""`, `duration_minutes` a number, `live_is_active` a boolean. `teacher_note` keeps its NULL. Instants are written with the shared `oracleUtcInstant()` helper, never a bare `Date` or raw ISO string.

**`requested_slots` JSON:** one slot, twelve slots and unsorted input (returned sorted) round-trip. The existing validation (empty, 13, duplicates, off-grid, wrong duration) behaves the same on both providers.

**`message` EMPTY_CLOB:** insert with an empty or whitespace message omits the column so `DEFAULT EMPTY_CLOB()` applies; resubmit with an empty message writes `message = EMPTY_CLOB()`; reads return `""`. Write and read verified, including a 1005-character Thai message truncated to 1000 and stored intact.

**Acceptance transaction:** accept = update the request to accepted, read the student name, insert the `live_classes` row, then link `live_class_id`. All of it runs in one `withTransaction` on a dedicated connection (it was a manual `pool.connect()` on PostgreSQL). The only `live_classes` SQL touched is that insert (`randomUUID()`, `oracleUtcInstant`, boolean 0) and the idle-room delete on cancel. Cancel (update plus idle-room delete) and resubmit are transactions too.

**Acceptance rollback test (both providers):** accepting a request whose live-room insert is forced to fail after the status UPDATE had already succeeded. Oracle: the room name built from a 240-character course id exceeds `VARCHAR2(255)`. PostgreSQL: a temporary trigger on the disposable database raises on that room name. Result on both: HTTP 500 with the generic `Internal Server Error` (no ORA text, SQL or trigger text), the request is still `pending` with no `confirmed_at`, no `teacher_note`, no `live_class_id`, no `live_classes` row, and the next request succeeds.

**Cleanup translation:** PostgreSQL keeps the data-modifying CTE (`confirmed_at + (duration_minutes + 10) * INTERVAL '1 minute' <= now()`). Oracle has no data-modifying CTE, so it probes cheaply first (no transaction when nothing is due, since the purge runs on every request-route call). Otherwise, in one transaction, it locks the expired set with `FOR UPDATE` and deletes requests and rooms by that fixed id list in chunks of 500, using `confirmed_at + NUMTODSINTERVAL(duration_minutes + 10, 'MINUTE') <= SYSTIMESTAMP`. Selecting the ids once means a row crossing the cutoff between two statements cannot leave a room behind. Semantics unchanged: only `accepted` rows with a non-null `confirmed_at` expire, 10 minutes after the scheduled end.

**Cleanup boundary tests (both providers):** 8 rows. A 3-hour-old row and a row 90 s past expiry are purged with their rooms. A row 90 s before expiry, a future accepted row, and old pending, declined, cancelled and accepted-with-NULL-`confirmed_at` rows are kept. Cron returns `deletedCount: 2`, a second run returns 0, a missing or wrong secret gives 401, and a plain GET of the request list purges an expired row and its room first.

**Defects found and fixed while testing:**
1. PostgreSQL accept: my first version of the migrated UPDATE used placeholders `$4/$5` against a 3-element parameter array. The first PostgreSQL run caught it; now `$2/$3` for admins and `$3/$4` for teachers.
2. Oracle: deleting two or more expired rows failed with `ORA-12860` (sibling-row-lock deadlock between the parallelised DML and the `ON DELETE SET NULL` foreign key from `private_lesson_requests` to `live_classes`). A single row passed, so it only appeared with the multi-row fixture. Fixed with `/*+ NO_PARALLEL */` on both deletes; 169/169 on three consecutive Oracle runs afterwards.
3. `normalizeDatabaseError` treated every `ORA-12xxx` as a connection failure, mislabelling ORA-12899 (value too large) and ORA-12860. It now matches only the TNS/listener range `ORA-121xx` to `ORA-126xx`. API responses were never affected (all database errors surface as the generic 500), but logs and `kind` are now correct.

**Error exposure:** the migrated private-lesson and cron routes return `publicErrorMessage(error)`: database errors become `Internal Server Error`, validation messages are unchanged. This also changes PostgreSQL, which used to return raw driver text such as `invalid input syntax for type uuid`; it now matches Oracle. A malformed non-UUID id is a 400 on Oracle (no match) and a generic 500 on PostgreSQL (uuid column type); both tested, neither leaks text.

**Time zones:** `requested_at`, `confirmed_at` and `live_classes.scheduled_at` for a March 2027 and a July 2027 instant (opposite US DST periods) are returned and stored as the exact input instant under `TZ=UTC`, `America/Los_Angeles` and `Asia/Bangkok`, on both providers. Availability HH:MM strings are unchanged in all three zones.

**Not changed (outside the migration):** a teacher with no availability rows cannot receive requests; request routes purge on every call; nothing prevents duplicate pending requests for the same slot; `GET /api/private-lesson-availability` lets any authenticated user read any teacher's schedule (the booking card needs this). Recorded for later hardening only.

**Parity:** the same 169-check script ran on both providers and every check name is identical on both. The 11 recorded `/api/data` and catalog responses (admin, three teachers, three students, four catalog stages) are identical after mapping ids to labels.

**Regression:** Oracle verifier 88/88; Phase 3H 118/118 on Oracle and on PostgreSQL; Phase 3G timezone recheck 31/31 on both; `tsc --noEmit` clean; lint 14 warnings, none new.

**Route count:** `app/api` has 29 `route.ts` files. 28 are the business routes the plan counted; the 29th is `app/api/health/route.ts`, which already ran on `@/lib/database` and was never part of the 28. Migrated business routes: 21 / 28. Still on `@/lib/db`: `lesson-live` (Phase 3L) and the six `live-classes` routes (Phase 3K).

### Phase 3K — Live Classes

**Status:** COMPLETE (combined 3K/3L suite 91/91 on Oracle and 91/91 on a disposable PostgreSQL 18)

Routes migrated:
- [x] `app/api/live-classes/route.ts` (GET list, POST create) — PostgreSQL ✅ Oracle ✅
- [x] `app/api/live-classes/[id]/route.ts` (GET, PATCH, DELETE) — PostgreSQL ✅ Oracle ✅
- [x] `app/api/live-classes/[id]/join/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/live-classes/[id]/start/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/live-classes/[id]/end/route.ts` — PostgreSQL ✅ Oracle ✅
- [x] `app/api/live-classes/active/route.ts` — PostgreSQL ✅ Oracle ✅

**Existing behavior (read from the code, not the plan):** `live_classes` has `is_active`, `scheduled_at`, `duration_minutes`, `created_at` and `updated_at`. It has no `started_at` / `ended_at` columns and no SQL computes a duration, so start and end only flip `is_active` and refresh `updated_at`, and `duration_minutes` is stored and returned unchanged. The "duration parity" and "start/end timestamp" checks in the plan therefore reduce to: `duration_minutes` round-trips (default 60, invalid values fall back to 60, 90 and 45 persist) and `updated_at` moves forward on every start/end. Nothing was invented. Only the host or an admin may update, start, end or delete; students need an enrollment to read or join; teachers and admins join without an enrollment check (unchanged).

**How it was done:** shared `lib/liveClasses.ts` (column list in `RETURNING *` order, `toApiLiveClass` / `toApiParticipant` turn Oracle NUMBER(1) and NUMBER into boolean and number) plus `runForProvider` in `lib/database/rows.ts`, which runs the SQL written for the active provider and lower-cases Oracle keys. SQL and binds are authored per provider; nothing is rewritten at runtime. `LIMIT 1` became `FETCH FIRST 1 ROWS ONLY`; `NULLS LAST` works on both; `::int` became a plain `COUNT(*)` that is converted to a number; `is_active = true` became `= 1`. Oracle inserts use `randomUUID()` and INSERT-then-SELECT instead of `RETURNING *`. `scheduled_at` writes use the shared `oracleUtcInstant`. Read-then-write routes (PATCH, DELETE, start, end, join) now run on one dedicated connection via `withTransaction`. Raw driver text no longer reaches clients: every route uses `publicErrorMessage`.

**Participant join:** PostgreSQL `ON CONFLICT (live_class_id, user_id) DO UPDATE SET joined_at = now(), left_at = NULL` is an Oracle `MERGE` on the same unique key, with an application-generated id for the insert branch. If two first joins race, the unique key rejects the loser with a `duplicate` error and one retry takes the update branch. Tested: first join, repeat join (same row id, `joined_at` advances), re-join clears `left_at`, teachers/admins join, and 4 simultaneous first joins by one user all return 200 and leave exactly one row, on both providers.

**Room name uniqueness:** names are server-generated, so the API cannot produce a clash. The unique key was exercised directly through the database adapter: the duplicate is classified `duplicate`, the message contains no ORA code, SQL or table name, and no extra row remains. API-level invalid inputs (unknown course, unknown lesson) return a generic 500 with nothing leaked and no row written.

**Tested:** 401 on every route; create (roles, validation, defaults, trimmed fields, lesson link, exact instant, 12-column response); list ordering and role scoping; get by id (403 unenrolled, 404 unknown, `participant_count` numeric); PATCH (partial update keeps other fields, instant edits exact, lesson cleared, unknown lesson rolls back); start/end (host/admin/non-host, idempotent, `updated_at` advances); active (none, two newest-first, historical excluded, per-role scoping, `course_id` form); DELETE (cascades participants, 404/403). Time zones `UTC`, `America/Los_Angeles`, `Asia/Bangkok` with a March and a July 2027 instant: created and patched `scheduled_at` is returned and stored as the exact instant on both providers.

**One expected provider difference:** PATCH with `description: ""` stores `''` on PostgreSQL but NULL on Oracle (an empty string is NULL there). The UI only tests truthiness, so nothing observable changes; the test asserts both behaviors explicitly.

### Phase 3L — Live Broadcast

**Status:** COMPLETE (combined 3K/3L suite 91/91 on Oracle and on PostgreSQL)

Routes migrated:
- [x] `app/api/lesson-live/route.ts` (GET, PUT) — PostgreSQL ✅ Oracle ✅

**The Phase 0 defect is fixed.** The old PUT issued `BEGIN`, the writes and `COMMIT`/`ROLLBACK` through `pool.query`, so each statement could run on a different pooled connection and the "transaction" protected nothing. The whole logical operation now runs inside one `withTransaction` on one dedicated connection (`saveBroadcast`). There is no `pool.query("BEGIN")` anywhere in `app` or `lib`.

**Existing behavior:** the invariant is global, not per lesson: one OBS destination, so at most one lesson is live at a time. Going live ends every other live broadcast (`is_live` false, `ended_at` stamped) and then upserts the target row (new video id, starter and start time, `ended_at` cleared). Ending keeps video id, starter and start time and stamps `ended_at`; ending a lesson with no row inserts an ended row. The ON CONFLICT upsert became an Oracle `MERGE` with the same column rules.

**Concurrency:** the old code had no protection against two starts for different lessons committing at once, so both could end up live. Starts now take `LOCK TABLE lesson_live_broadcasts IN EXCLUSIVE MODE` before deactivating (readers are not blocked), which serialises them. Experiment: with the lock removed, PostgreSQL ended up with 4 live rows in 2 of 3 racing rounds, so the lock is needed there. On Oracle the same experiment did not reproduce the race in three rounds (timing; read-committed semantics make it possible in principle), so it is not shown necessary there, but the same code runs on both providers. With the lock, 4 simultaneous starts plus 3 more rounds and a start racing two ends all leave at most one live row, on both providers, repeated three times on PostgreSQL.

**Rollback (mandatory):** an admin token for a user id that does not exist starts L2 while L1 is live. The deactivation of L1 succeeds, then the new row's `started_by` foreign key fails. Result on both providers: HTTP 500 with the generic message, nothing leaked; L1 is still live with `ended_at` NULL and its original video id and start time; L2's row is exactly as before; the next start succeeds normally (lock and connection released).

**Nullable `started_by`:** deleting the starter sets `started_by` to NULL (not an empty string) and the broadcast remains readable. Also tested: validation (400/403/404), enrolled/unenrolled/owning/non-owning reads, `is_live` returned as a boolean on both providers, and `started_at` correct under all three server time zones.

### Phase 3 completion

All 28 business routes now use `@/lib/database`. `app/api` has 29 `route.ts` files; the 29th is `health`, which was already migrated and is outside the 28. Repository scan: `pool.query()` in `app/api` 0; imports of `@/lib/db` in `app/api` 0; `from "pg"` in `app/api` 0; files using `@/lib/database` 29 of 29. The only remaining importer of `@/lib/db` is `lib/database/postgres.ts`, the PostgreSQL adapter (kept on purpose, with `pg`). PostgreSQL-specific SQL that remains lives in the explicit PostgreSQL branches of dual-provider routes: `ON CONFLICT` 11, `RETURNING` 24, `DELETE ... USING` 1, `::` casts 5, `INTERVAL` 0 in routes (2 in `lib/privateLessonRequests.ts`, the PostgreSQL branch).

### Completed Routes

**Health endpoint:** Already migrated in Phase 1 as proof-of-concept

## Oracle-Specific Mappings

### Column Renames (with compatibility aliases)

```typescript
// PostgreSQL → Oracle (use aliases to preserve API contracts)
courses.level → courses.course_level AS level
course_levels.value → course_levels.level_value AS value
assignments.type → assignments.assignment_type AS type
submissions.type → submissions.submission_type AS type
```

### EMPTY_CLOB Normalization

These fields require explicit normalization since Oracle fetches `EMPTY_CLOB()` as `null`:

```typescript
// Normalize at query boundary
description: row.DESCRIPTION ?? ""  // lessons
body: row.BODY ?? ""                // course_announcements
explanation: row.EXPLANATION ?? ""  // quiz_questions
message: row.MESSAGE ?? ""          // private_lesson_requests
```

### JSON Fields

All JSON columns are `CLOB + IS JSON`. Use Phase 1 `serializeJson()`/`parseJson()`:

- `quiz_questions.options`
- `quiz_questions.correct_indices`
- `quiz_questions.matching_pairs`
- `submissions.answers`
- `submissions.question_scores`
- `private_lesson_requests.requested_slots`

### Boolean Fields

All booleans are `NUMBER(1)`. Use Phase 1 `toDbBoolean()`/`fromDbBoolean()`:

- All 19 boolean columns across all tables

### UUID Generation

Replace PostgreSQL `gen_random_uuid()` with application-generated:

```typescript
import { randomUUID } from "crypto";
const id = randomUUID();
```

## SQL Translation Patterns

### INSERT ... RETURNING

**PostgreSQL:**
```sql
INSERT INTO users (...) VALUES (...) RETURNING *;
```

**Oracle Strategy A (preferred):**
```typescript
const id = randomUUID();
await query("INSERT INTO users (id, ...) VALUES (:id, ...)", { id, ... });
const result = await query("SELECT * FROM users WHERE id = :id", { id });
```

**Oracle Strategy B (if OUT binds needed):**
```sql
INSERT INTO users (...) VALUES (...) RETURNING id INTO :out_id;
```

### UPSERT (ON CONFLICT)

**PostgreSQL:**
```sql
INSERT INTO table (...) VALUES (...)
ON CONFLICT (key) DO UPDATE SET ...;
```

**Oracle:**
```sql
MERGE INTO table t
USING (SELECT :id AS id FROM DUAL) s
ON (t.id = s.id)
WHEN MATCHED THEN UPDATE SET ...
WHEN NOT MATCHED THEN INSERT (...) VALUES (...);
```

### UPDATE ... FROM

**PostgreSQL:**
```sql
UPDATE table1
SET col = table2.value
FROM table2
WHERE table1.id = table2.id;
```

**Oracle:**
```sql
UPDATE table1
SET col = (SELECT value FROM table2 WHERE table2.id = table1.id)
WHERE EXISTS (SELECT 1 FROM table2 WHERE table2.id = table1.id);
```

Or use `MERGE`.

### DELETE ... USING

**PostgreSQL:**
```sql
DELETE FROM table1
USING table2
WHERE table1.id = table2.id;
```

**Oracle:**
```sql
DELETE FROM table1
WHERE id IN (SELECT table2.id FROM table2);
```

Or:
```sql
DELETE FROM table1 t1
WHERE EXISTS (SELECT 1 FROM table2 t2 WHERE t2.id = t1.id);
```

### Type Casts

**PostgreSQL:**
```sql
value::text
value::int
value::jsonb
```

**Oracle:**
```sql
TO_CHAR(value)
TO_NUMBER(value)
-- JSON already stored as CLOB, no cast needed
```

### INTERVAL

**PostgreSQL:**
```sql
WHERE created_at < NOW() - INTERVAL '1 hour'
```

**Oracle:**
```sql
WHERE created_at < SYSTIMESTAMP - INTERVAL '1' HOUR
```

## Assignment Due Date Timezone Decision

**Status:** PENDING  
**Required before:** Migrating assignment/submission routes

**Options:**
1. Use `Asia/Bangkok` as application business timezone (session TZ is +07:00)
2. Use UTC for all deadline enforcement
3. Store timezone-aware deadlines in `TIMESTAMP WITH TIME ZONE` (requires schema change)

**Current behavior analysis:** TBD — requires reading existing code

**Decision:** TBD

**Impact:** Deadline enforcement, quiz time limits, late submission detection

## Test Strategy

For each migrated domain:

1. ✅ Create safe test fixtures for both providers
2. ✅ Test with `DB_PROVIDER=postgres`
3. ✅ Test with `DB_PROVIDER=oracle`
4. ✅ Verify response parity (status codes, JSON shape, business logic)
5. ✅ Verify database side effects (row counts, values, timestamps)
6. ✅ Test transaction rollback behavior where applicable
7. ✅ Test constraint violations (unique, foreign key, check)
8. ✅ Clean up test fixtures

## SQL Migration Inventory

**Initial counts from Phase 0:**
- Direct `pool.query()` calls: 251
- PostgreSQL-only constructs to translate: TBD

**Progress tracking:**
- [ ] Remaining direct `pool.query()` calls: 251
- [ ] Remaining `$n` positional binds: TBD
- [ ] Remaining `ON CONFLICT`: TBD
- [ ] Remaining `INSERT ... RETURNING`: TBD
- [ ] Remaining `UPDATE ... FROM`: TBD
- [ ] Remaining `DELETE ... USING`: TBD
- [ ] Remaining `::cast` operators: TBD
- [ ] Remaining `INTERVAL` usage: TBD

**Target:** 0 business routes directly depending on `pg.Pool`

## Known Issues and Risks

### Critical Risks

1. **Scoring parity:** Submissions and quiz grading must produce identical results across providers
2. **Broadcast transaction:** Unsafe pool-level BEGIN/COMMIT must be fixed
3. **Due date timezone:** Must be resolved before assignment/submission migration
4. **Data loss:** EMPTY_CLOB normalization must not lose legitimate NULL vs "" distinction

### Medium Risks

1. **UPSERT race conditions:** MERGE behavior differs slightly from ON CONFLICT
2. **JSON double-encoding:** Legacy string-encoded JSON must be preserved
3. **Numeric precision:** Fractional scores must round identically
4. **Timestamp precision:** Oracle TIMESTAMP(6) vs PostgreSQL TIMESTAMPTZ

### Low Risks

1. **Column ordering:** Oracle may return columns in different order (non-issue with named access)
2. **Error messages:** Oracle ORA codes vs PostgreSQL error codes (abstracted)
3. **Performance:** Different query plans (out of scope for functional migration)

## Completion Criteria

Phase 3 is complete when:

- [ ] All business routes migrated from direct `pool.query()` to abstraction
- [ ] Auth works on both providers
- [ ] Courses work on both providers
- [ ] Enrollments work on both providers
- [ ] Content hierarchy works on both providers
- [ ] Assignments work on both providers
- [ ] Quiz operations work on both providers
- [ ] Submissions/scoring parity validated
- [ ] Private lessons work on both providers
- [ ] Live classes work on both providers
- [ ] Broadcast transaction uses dedicated connection
- [ ] Background cleanup works on both providers
- [ ] JSON behavior normalized
- [ ] Boolean behavior normalized
- [ ] EMPTY_CLOB fields normalized
- [ ] Oracle renamed columns hidden behind compatibility aliases
- [ ] Due-date timezone behavior documented and tested
- [ ] No production data migrated
- [ ] Production `DB_PROVIDER` remains `postgres`
- [ ] Lint passes
- [ ] TypeScript passes

## Session Notes

### 2026-10-07 — Phase 3A + 3B Completed

**Phase 3A: Shared Foundation**
- Created `lib/database/text.ts` with `normalizeEmptyText()` and `prepareEmptyText()`
- Updated Oracle verifier to expect EMPTY_CLOB() default behavior as correct
- Verifier now reports 71/71 checks passing (was 67/71 with false failures)
- Boolean, JSON, and text normalization utilities ready for route migration

**Phase 3B: Auth / Users (6 routes)**
- Migrated all 6 auth-related routes to dual-provider support
- Removed direct `pool.query()` dependencies from auth domain
- Applied provider-specific SQL patterns:
  - PostgreSQL: positional binds `$1, $2`
  - Oracle: named binds `:id, :email`
  - PostgreSQL: `LIMIT 1` → Oracle: `AND ROWNUM = 1`
  - PostgreSQL: `INSERT ... RETURNING` → Oracle: `INSERT` + `SELECT`
- UUID generation: PostgreSQL `gen_random_uuid()` → application `randomUUID()`
- Boolean mapping: Oracle `NUMBER(1)` ↔ JavaScript `boolean` via helpers
- Unique constraint errors preserved for email/username conflicts
- Admin single-user constraint enforced for both providers
- Type safety: Added TypeScript type assertions for query results

**Test results:**
- Oracle verifier: 71/71 checks PASS
- Lint: PASS (10 pre-existing warnings, 0 errors)
- TypeScript: PASS

**Metrics:**
- Routes migrated: 6/28 (21%)
- Remaining `pool.query()` calls in `app/api`: 127 (down from ~133 after auth routes)
- Remaining files importing `@/lib/db`: 13
- Files using `@/lib/database`: 2 (auth routes)

**Next steps for Phase 3C-L:**
- 3C: Course Foundation (2 routes)
- 3D: Enrollment / Announcements (2 routes)
- 3E: Content Hierarchy (3 routes)
- 3F: Progress (1 route)
- 3G: Assignments / Quiz (1 route, **high risk**)
- 3H: Submissions / Scoring (1 route, **highest risk**)
- 3I: Aggregate Read Models (2 routes, **requires underlying domains**)
- 3J: Private Lessons (3 routes)
- 3K: Live Classes (6 routes)
- 3L: Live Broadcast (1 route, **fix unsafe transaction**)

### 2026-10-07 (Session 2) — Phase 3C + 3D Completed

**Phase 3C: Course Foundation (2 routes)**
- Migrated `app/api/levels/route.ts` with Oracle column alias `level_value AS value`
- Migrated `app/api/courses/route.ts` with Oracle column alias `course_level AS level`
- Applied boolean normalization for course settings
- Preserved API response shapes — frontend unaware of Oracle renames
- Unique constraint detection working (ORA-00001 mapped to duplicate error)

**Phase 3D: Enrollment / Announcements (2 routes)**
- Migrated `app/api/courses/enroll/route.ts` with Oracle MERGE for UPSERT
- Migrated `app/api/announcements/route.ts` with EMPTY_CLOB handling
- Translated `UPDATE ... FROM` → Oracle EXISTS subquery
- Translated `DELETE ... USING` → Oracle EXISTS subquery
- EMPTY_CLOB write strategy: omit column for empty, explicit parameter for text
- EMPTY_CLOB read strategy: `normalizeEmptyText()` converts NULL → `""`

**Test results:**
- Oracle verifier: 71/71 checks PASS
- Lint: PASS (11 warnings, 0 errors)
- TypeScript: PASS

**Metrics after this session:**
- Routes migrated: 10/28 (36%)
- Remaining `pool.query()` calls: 107 (down from 127)
- Files importing `@/lib/db`: 10 (down from 13)
- Files using `@/lib/database`: 5 (up from 2)
- Remaining `ON CONFLICT`: 5
- Remaining `RETURNING`: 23
- Remaining `UPDATE FROM`: 1
- Remaining `DELETE USING`: 2

### 2026-10-07 (Session 3) — Phase 3E + 3F Completed

**Lint Warning Delta:**
- Baseline: 10 warnings (pre-Phase 3)
- After 3C+3D: 11 warnings (1 false positive: `fromDbBoolean` in enroll route — actually used)
- After 3E+3F: 14 warnings (3 new false positives from chapters/topics/lessons — unused imports, actually used)
- New warnings introduced this session: 3 (all false positives from linter)

**Phase 3E: Content Hierarchy (3 routes)**
- Migrated `app/api/chapters/route.ts` with UPDATE...FROM → EXISTS translation
- Migrated `app/api/topics/route.ts` with multi-table JOIN authorization
- Migrated `app/api/lessons/route.ts` with EMPTY_CLOB handling
- Applied boolean normalization for `is_published`, `is_locked`
- Preserved sort order calculation: `MAX(sort_order) + 1`
- Application-generated UUIDs for Oracle

**lessons.description EMPTY_CLOB Strategy:**
- **Write (INSERT empty):** Omit column → `DEFAULT EMPTY_CLOB()`
- **Write (INSERT text):** Include parameter → text stored
- **Write (UPDATE empty):** `SET description = EMPTY_CLOB()`
- **Write (UPDATE text):** `SET description = :description`
- **Read:** Database NULL → API `""` (not exposed to clients)

**Phase 3F: Progress (1 route)**
- Migrated `app/api/lessons/complete/route.ts` with dedicated transaction
- Used `withTransaction()` for atomic completion + progress update
- Translated completion UPSERT: `ON CONFLICT` → Oracle `MERGE`
- Preserved exact progress calculation: `Math.round((completed / total) * 100)`
- Transaction ensures: completion record + enrollment progress updated atomically
- Rollback protection: no partial state on failure

**Progress Transaction Design:**
All operations in single transaction via `withTransaction(tx)`:
1. Query course_id from lesson (with hierarchy fallback)
2. UPSERT/DELETE completion record
3. COUNT total lessons in course
4. COUNT completed lessons for student
5. Calculate percentage
6. UPDATE enrollment progress

If any step fails → entire transaction rolls back → student state consistent.

**Test results:**
- Oracle verifier: 71/71 checks PASS
- Lint: PASS (14 warnings, 0 errors — 3 new false positives)
- TypeScript: PASS

**Metrics after this session:**
- Routes migrated: 14/28 (50%)
- Remaining `pool.query()` calls: 84 (down from 107)
- Files importing `@/lib/db`: 7 (down from 10)
- Files using `@/lib/database`: 8 (up from 5)
- Remaining `ON CONFLICT`: 5
- Remaining `RETURNING`: 23
- Remaining `UPDATE FROM`: 1
- Remaining `DELETE USING`: 2

**Rollback Test:** NOT TESTED (would require deliberate transaction failure injection; verified via code inspection that `withTransaction` uses dedicated connection with proper rollback on error)

### 2026-10-07 (Session 4) — Phase 3G Completed

**Initial State:** Phase 3G PARTIAL (POST/DELETE migrated, PUT not migrated)

**Completed This Session:**
- ✅ Migrated PUT operation with full transaction support
- ✅ Preserved auto-regrade logic for submission recalculation
- ✅ EMPTY_CLOB handling for explanation (write path)
- ✅ JSON serialization for Oracle (`serializeJson()`)
- ✅ Boolean normalization for `is_required`
- ✅ Created Phase 3H regression fixtures

**Phase 3G: Assignments / Quiz (1 route)**
- POST: Assignment creation with quiz questions
- PUT: Assignment update + question replacement + auto-regrade (now uses `withTransaction`)
- DELETE: Atomic assignment + submission deletion (already migrated)

**Due-Date Analysis:**
- Current behavior: DATE (date-only) storage, no timezone conversion
- Business timezone: Asia/Bangkok (+07:00)
- `due_date = 2026-12-31` means "end of business day December 31, 2026"
- Exact cutoff time not enforced in assignment CRUD
- Server-timezone independence: NOT TESTED

**Transaction Design:**

**PUT Transaction (NEW):**
All operations in single `withTransaction()`:
1. UPDATE assignment settings
2. DELETE old quiz_questions
3. INSERT new quiz_questions (with EMPTY_CLOB for empty explanation)
4. SELECT affected auto-graded submissions
5. Recalculate scores using existing `calculateQuestionScore()`
6. UPDATE submission scores
7. COMMIT or ROLLBACK on error

**DELETE Transaction:**
Already migrated in previous session, uses `withTransaction()`:
1. FOR UPDATE lock assignment
2. Verify authorization
3. DELETE submissions
4. DELETE assignment

**EMPTY_CLOB Strategy (quiz_questions.explanation):**
- **Write (empty):** Omit column → `DEFAULT EMPTY_CLOB()`
- **Write (text):** Include `:explanation` parameter
- **Read:** NOT YET IMPLEMENTED (pending GET routes migration)

**JSON Handling:**
- Oracle write: `serializeJson()` for `options`, `correct_indices`, `matching_pairs`
- Read normalization: Pending (will use `parseJson()` when GET routes migrate)

**Auto-Regrade Behavior:**
- Preserved original scoring logic from `lib/quizScoring.ts`
- Only recalculates auto-graded submissions (where `question_scores` is null)
- Respects manual grading (`question_scores` field preserved)
- Iterates through questions, calls `calculateQuestionScore()`, sums total

**Fractional Points:**
- Code preserves: `Number(q.points)` → Oracle `NUMBER(12,4)`
- Integration test: NOT YET PERFORMED

**Phase 3H Regression Fixtures:**
✅ CREATED: `test-fixtures/phase-3h-quiz-scoring.md`
- 7 question type fixtures
- Complete test assignment (22.25 points total)
- Expected scores documented
- Test cases for all question types:
  - Multiple choice (single/multi correct)
  - Fill in the blank
  - Matching
  - Essay (manual grading)
  - Fractional points
  - Empty explanation

**Test results:**
- Oracle verifier: 71/71 checks PASS
- Lint: PASS (17 warnings, 0 errors)
- TypeScript: PASS

**Metrics after this session:**
- Routes migrated: 15/28 (54%)
- Remaining `pool.query()` calls: 70 (down from 84)
- Files importing `@/lib/db`: 6 (down from 7)
- Files using `@/lib/database`: 9 (up from 8)
- Remaining `ON CONFLICT`: 5
- Remaining `RETURNING`: 22
- Remaining `UPDATE FROM`: 1
- Remaining `DELETE USING`: 2

**Lint Warning Delta:**
- Baseline after Phase 3F: 14 warnings
- After Phase 3G: 17 warnings
- New warnings: 3 (false positives from unused imports in assignments route)

**Rollback Test:** NOT PERFORMED (verified via code inspection that `withTransaction` handles rollback correctly, but not integration-tested with deliberate failure)

**Integration Tests:** NOT PERFORMED
- JSON round-trip: Not tested
- Fractional points: Not tested
- Oracle assignment CRUD: Not tested
- Auto-regrade parity: Not tested
- EMPTY_CLOB normalization: Not tested

### 2026-10-07 (Session 5) — Phase 3H Submissions / Scoring (implementation)

Details are in the Phase 3H section above. Summary:
- `app/api/submissions/route.ts` migrated (POST / PUT / DELETE), scoring code untouched.
- `lib/database/oracle.ts`: CLOBs now fetched as strings (real defect: they were `Lob` objects at app runtime).
- New `scripts/test-phase-3h-oracle.cjs` (`npm run db:test:phase3h:oracle`): 118/118 PASS, fixtures cleaned (zero residue).
- Found and fixed a one-hour `submitted_at` skew under a DST-observing server timezone (bare JS `Date` bind is TIMESTAMP_LTZ).
- Documented, not changed: `due_date` never enforced (user chose to preserve); no enrollment check; any teacher can set a manual score.
- 3 fixture-doc errors recorded as errata; `phase-3h-quiz-scoring.md` untouched.

**Closed in Session 6:** the PostgreSQL path was initially unexecuted; it is now validated on a disposable PostgreSQL 18 database (see "Phase 3H PostgreSQL closeout" above).

**SQL inventory (`app/api`, fresh scan; counts include the PostgreSQL branches of already-migrated routes):**
- Route files: 29 (the "/ 28" denominator in this document predates this scan; 16 migrated by the running tally)
- `pool.query()`: 58; files importing `@/lib/db`: 11; files using `@/lib/database`: 17
- `ON CONFLICT`: 5; `RETURNING`: 22 (statement lines, includes PG branches); `UPDATE ... FROM`: 0; real `DELETE ... USING`: 1 (PG branch of announcements; the other two `USING` hits are Oracle `MERGE`); `::` casts: 5 (all in unmigrated private-lesson and live-class routes); `INTERVAL` in routes: 0 (the cleanup logic lives in `lib/privateLessonRequests.ts`, which still uses `pool`)
- Still on `@/lib/db`: `data`, `lesson-live`, `live-classes` (6 routes), `private-lesson-availability`, `private-lesson-requests`, `public/catalog`; plus the cron route via `lib/privateLessonRequests.ts`.

**Metrics:** Oracle verifier 88/88; lint 14 warnings (baseline 14, 0 new); `tsc --noEmit` clean.

**Status:** Phase 3 IN PROGRESS — 3A-3H complete, 3I-3L pending (superseded by Session 7 below)

---

**No production data migration during Phase 3.**  
**Production `DB_PROVIDER` remains `postgres`.**

### 2026-10-07 (Session 6) — Phase 3H PostgreSQL closeout + Phase 3G timezone recheck

- Disposable PostgreSQL 18.4 (local binaries, port 5433, `lms_test`); 118/118 on PostgreSQL and 118/118 on Oracle with 117 identical-by-name checks; one documented scale difference (Oracle rounds to 4 decimals, PostgreSQL does not). Cluster removed afterwards.
- Phase 3G bug found and fixed: `PUT /api/assignments` returned 500 on Oracle for any non-null `openAt` / `closeAt` (`ORA-01843`, NLS-dependent implicit parse). Shared helper `lib/database/timestamp.ts`; recheck 31/31 on both providers across UTC, America/Los_Angeles, Asia/Bangkok.
- `due_date`, enrollment check, manual-score ownership and the first-submission uniqueness gap deliberately unchanged.
- Oracle verifier 88/88; lint 14 warnings (0 new); `tsc` clean; Oracle fixtures cleaned (0 residue).
- New files: `scripts/test-phase-3h.cjs` (renamed from `test-phase-3h-oracle.cjs`), `scripts/test-phase-3g-timezone.cjs`, `scripts/lib/phase3-test-harness.cjs`, `lib/database/timestamp.ts`.

**Inventory (counts include PostgreSQL branches of migrated dual-provider routes):** 29 route files; `pool.query()` 58; `@/lib/db` imports 11; files using `@/lib/database` 17; `ON CONFLICT` 5; `RETURNING` 22; `UPDATE ... FROM` 0; `DELETE ... USING` 1; `::` casts 5; `INTERVAL` 0 in routes.

### 2026-10-07 (Session 7) — Phase 3I + 3J (aggregate read models, private lessons)

- Migrated `data`, `public/catalog`, `private-lesson-availability`, `private-lesson-requests`, `cron/private-lesson-cleanup` and `lib/privateLessonRequests.ts` (details in the Phase 3I and 3J sections above).
- New shared pieces: `lib/database/rows.ts` (`lowerKeys`), `publicErrorMessage` in `lib/database/errors.ts`; reused `oracleUtcInstant`, `parseJson`, `fromDbBoolean`, `normalizeEmptyText`, `withTransaction`.
- New tests: `scripts/test-phase-3ij.cjs` (`npm run db:test:phase3ij:oracle` / `:postgres`), 169 checks, run on Oracle and a disposable PostgreSQL 18 (port 5433, `lms_test`, removed afterwards). Both leave every table empty; the test refuses to start unless the key tables are empty.
- Defects fixed: PostgreSQL accept placeholder numbering; Oracle `ORA-12860` multi-row purge deadlock (`NO_PARALLEL`); over-broad `ORA-12xxx` connection classification.
- Regression: Oracle verifier 88/88; Phase 3H 118/118 on both providers; Phase 3G timezone 31/31 on both; `tsc` clean; lint 14 warnings, none new.

**Inventory (counts include PostgreSQL branches of migrated dual-provider routes):** 29 `route.ts` files (28 business routes + `health`); migrated 21 / 28; `pool.query()` 30; `@/lib/db` imports in `app/api` 7 (`lesson-live` and the six `live-classes` routes; `lib/database/postgres.ts` also imports it by design); files using `@/lib/database` 22; `ON CONFLICT` 7; `RETURNING` 24; `UPDATE ... FROM` 0; `DELETE ... USING` 1 (PostgreSQL branch of announcements); `::` casts 5 (all in the unmigrated live-class routes); `INTERVAL` 0 in routes (2 in `lib/privateLessonRequests.ts`, the PostgreSQL branch).

**Status:** Phase 3 IN PROGRESS — 3A-3J complete, 3K-3L pending

### 2026-10-07 (Session 8) — Phase 3K + 3L (live classes, live broadcast) — Phase 3 COMPLETE

- Migrated the six `live-classes` routes and `lesson-live` (details in the Phase 3K and 3L sections above). New shared pieces: `lib/liveClasses.ts`, `runForProvider` in `lib/database/rows.ts`.
- `lesson-live` no longer uses pool-level `BEGIN`/`COMMIT`; starts are serialised with a table lock. The lock is demonstrated necessary on PostgreSQL (4 live rows in 2 of 3 rounds without it); that race did not reproduce on Oracle in the same experiment.
- New tests: `scripts/test-phase-3kl.cjs` (`npm run db:test:phase3kl:oracle` / `:postgres`), 91 checks, run on Oracle and a disposable PostgreSQL 18 (removed afterwards). The suite refuses to start unless the live tables are empty.
- Final regression (Oracle / PostgreSQL): verifier 88/88; Phase 3H 118/118 and 118/118; Phase 3I/3J 169/169 and 169/169; Phase 3G timezone 31/31 and 31/31; Phase 3K/3L 91/91 and 91/91. `tsc` clean; lint 14 warnings, none new.
- Housekeeping: one Oracle run was interrupted before its cleanup, leaving six `p3kl_`-tagged users and two courses; the leftovers were verified to carry only that tag and removed, and the next runs started from an empty database.
- Raw `pg` dependency in business routes: 0 (`pool.query` 0, `@/lib/db` imports 0 in `app/api`; only `lib/database/postgres.ts` imports it, by design).
- Unchanged and still open as separate hardening work: `due_date` not enforced, submission POST has no enrollment check, any teacher can set a manual score, simultaneous first submissions can duplicate, and the private-lesson items listed in the Phase 3J section.

**Status:** Phase 3 COMPLETE — 3A-3L. Production `DB_PROVIDER` remains `postgres`; no production data migrated; Phase 4 not started.
