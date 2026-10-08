# Phase 0 — Database Migration Audit

**Scope:** `front-lms` application repository, audited 2026-10-07. This is an inventory only. No driver, SQL, schema, configuration, or application behavior was changed.

## 1. Executive Summary

The application uses `pg` 8.21.0, a singleton `Pool` in `lib/db.ts`, and raw parameterized SQL from Next.js route handlers. The active schema is created and mutated by `migrateDatabase()` in `lib/db.ts`; `scripts/migrate.cjs` transpiles and invokes it. `npm run build` runs that migration before `next build`.

| Measure | Result |
|---|---:|
| Database-related files | 38 (30 direct runtime-query files, 1 migration runner, 7 static SQL artifacts) |
| Direct `pool.query` call sites | 231 |
| Direct `client.query` call sites | 20 |
| Static query-dispatch call sites | 251 |
| Tables in active runtime schema | 19 |
| Explicit transactional workflows | 3 |
| `ON CONFLICT` occurrences in active runtime sources | 7 |
| `RETURNING` occurrences in active runtime sources | 26 |
| Highest-risk areas | 6: runtime DDL/build coupling, quiz scoring, private-lesson acceptance/cleanup, live broadcast, UPSERTs, legacy schema drift |

`251` is the exact source count of `pool.query` + `client.query`, not a fixed production execution count: question and availability loops execute statements per item, and conditional/dynamic queries select different statements at runtime. Keyword totals below are lexical occurrences in direct-query files; CTEs and comments mean they must not be treated as a one-query-per-keyword count.

## 2. Current Database Architecture

- `lib/db.ts` imports `Pool` from `pg`, using `DATABASE_URL` and `DATABASE_SSL`. It configures SSL permissively, max 20 clients, serverless-oriented `allowExitOnIdle`, and a `SELECT 1` keep-alive.
- All route SQL uses PostgreSQL `$n` positional binds and consumes `pg` result objects (`rows`, `rowCount`).
- `ensureTables()` is presently a no-op, despite being called by most database routes. `migrateDatabase()` contains the actual creation and incremental alteration logic.
- `scripts/migrate.cjs` reads/transpiles `lib/db.ts`, invokes `migrateDatabase()`, then calls `pool.end()`.
- Active static SQL artifacts are not invoked by `package.json`; they are historical/manual schema, index, repair, and Supabase scripts. They are still migration-relevant because they disagree with the active schema.

## 3. Database Access Inventory

Risk reflects SQL portability and data integrity, not route authorization.

| File | Function / route | Operation / tables | Calls | PostgreSQL-specific / risk |
|---|---|---|---:|---|
| `lib/db.ts` | Pool, migration, health helpers | DDL for all 19 tables; catalog checks | 88 | UUID, JSONB, TIMESTAMPTZ, booleans, catalog SQL, idempotent DDL, partial index — **CRITICAL** |
| `scripts/migrate.cjs` | `db:migrate` runner | invokes `migrateDatabase`, closes pool | 0 direct | runtime transpilation/deployment coupling — **CRITICAL** |
| `lib/privateLessonRequests.ts` | cron cleanup helper | `private_lesson_requests`, `live_classes` | 1 | CTE multi-delete, `INTERVAL`, `::int`, `RETURNING` — **CRITICAL** |
| `app/api/data/route.ts` | GET dashboard aggregate | users, courses, hierarchy, assignments, quiz, submissions, enrollments, completions | 15 | joins, limits, result mapping — **HIGH** |
| `app/api/assignments/route.ts` | POST/PUT/DELETE | assignments, quiz_questions, submissions, lessons | 22 | transaction, row lock, JSON writes, scoring — **CRITICAL** |
| `app/api/submissions/route.ts` | POST/PUT/DELETE | submissions, assignments, questions, courses | 12 | JSON/scoring, date rules, multi-table authorization — **HIGH** |
| `app/api/private-lesson-requests/route.ts` | GET/POST/PUT/DELETE | requests, availability, courses, users, live_classes | 18 | acceptance transaction, dynamic SQL, `RETURNING`, time values — **CRITICAL** |
| `app/api/private-lesson-availability/route.ts` | GET/PUT | teacher availability | 5 | transaction, `::time`, UPSERT — **HIGH** |
| `app/api/lesson-live/route.ts` | GET/POST | broadcasts, lessons, courses, enrollments | 11 | transaction expressed on pool, UPSERT, global active-state update — **CRITICAL** |
| `app/api/courses/enroll/route.ts` | POST/DELETE | courses, enrollments | 7 | three duplicate UPSERT forms — **HIGH** |
| `app/api/lessons/complete/route.ts` | POST | lessons, hierarchy, completions, enrollments | 7 | UPSERT plus calculated progress writes — **HIGH** |
| `app/api/announcements/route.ts` | GET/POST/PUT/DELETE | announcements, courses, enrollments | 6 | `UPDATE ... FROM`, `DELETE ... USING`, `RETURNING` — **HIGH** |
| `app/api/live-classes/route.ts` | GET/POST | live_classes, participants, courses | 3 | `::int`, dynamic filters, `RETURNING` — **HIGH** |
| `app/api/live-classes/[id]/route.ts` | GET/PUT/DELETE | live_classes, participants, courses, enrollments | 6 | `::int`, `RETURNING` — **HIGH** |
| `app/api/live-classes/[id]/join/route.ts` | POST | live_classes, enrollments, participants | 3 | UPSERT + `RETURNING` — **HIGH** |
| `app/api/live-classes/[id]/start/route.ts` | POST | live_classes | 2 | `RETURNING` — **MEDIUM** |
| `app/api/live-classes/[id]/end/route.ts` | POST | live_classes | 2 | `RETURNING` — **MEDIUM** |
| `app/api/courses/route.ts` | POST/PUT | courses | 4 | `RETURNING`, boolean literals — **MEDIUM** |
| `app/api/chapters/route.ts` | POST/PUT/DELETE | chapters, courses | 5 | `UPDATE ... FROM`, `RETURNING` — **HIGH** |
| `app/api/topics/route.ts` | POST/PUT/DELETE | topics, chapters, courses | 5 | `UPDATE ... FROM`, `RETURNING` — **HIGH** |
| `app/api/lessons/route.ts` | POST/PUT/DELETE | lessons, topics, chapters | 6 | fallback schema compatibility flow — **HIGH** |
| `app/api/levels/route.ts` | GET/POST/DELETE | course_levels | 3 | `RETURNING` — **MEDIUM** |
| `app/api/profiles/route.ts` | GET/PUT/DELETE | users | 4 | dynamically constructed `SET`/bind placeholder — **HIGH** |
| `app/api/admin/users/route.ts` | POST | users | 3 | duplicate/admin checks, `RETURNING` — **MEDIUM** |
| `app/api/auth/register/route.ts` | POST | users | 3 | duplicate/admin checks, `RETURNING` — **MEDIUM** |
| `app/api/auth/login/route.ts` | POST | users | 1 | simple lookup — **LOW** |
| `app/api/auth/me/route.ts` | GET | users | 1 | simple lookup — **LOW** |
| `app/api/auth/password/route.ts` | PUT | users | 2 | simple lookup/update — **LOW** |
| `app/api/public/catalog/route.ts` | GET | courses, users | 2 | joins/aggregates — **MEDIUM** |
| `app/api/health/route.ts` | GET | none (`SELECT 1`) | 1 | simple health probe — **LOW** |
| `app/api/cron/private-lesson-cleanup/route.ts` | GET | indirect via helper | 0 direct | operational dependency on critical cleanup query — **HIGH** |

The following static artifacts are database-related but have no runtime import discovered: `cockroachdb_schema.sql`, `sql/create_live_classes.sql`, `optimize-indexes.sql`, `fix-score-column.sql`, `supabase_schema.sql`, `supabase/profiles-rls.sql`, and `supabase/allow-read-profiles.sql`.

## 4. SQL Statistics

### Direct-query source scan

| Item | Count |
|---|---:|
| `pool.query` | 231 |
| `client.query` | 20 |
| `pool.connect` | 3 |
| Query-dispatch call sites | 251 |
| `SELECT` keyword occurrences | 120 |
| `INSERT` keyword occurrences | 32 |
| `UPDATE` keyword occurrences | 93 |
| `DELETE` keyword occurrences | 73 |
| `CREATE TABLE` keyword occurrences | 21 |
| `ALTER TABLE` keyword occurrences | 44 |
| `CREATE INDEX` keyword occurrences | 25 |
| `BEGIN` / `COMMIT` / `ROLLBACK` | 4 / 4 / 7 |

The keyword counts include nested CTE operations and source comments, so exact primary-statement totals cannot safely be inferred mechanically. The exact, reviewable total is 251 query dispatch call sites. Runtime execution total is data-dependent because loops insert every quiz question/availability day.

## 5. PostgreSQL-specific Feature Inventory

### Feature counts (active direct-query sources)

| Feature | Occurrences | Migration direction | Risk |
|---|---:|---|---|
| `$n` bind tokens | 386 | replace with named `:name` binds and explicit bind maps | Medium |
| `ON CONFLICT` | 7 | `MERGE`, or insert + duplicate handling inside a transaction | High |
| `RETURNING` | 26 | `RETURNING ... INTO` where supported by driver, otherwise select with key/transaction | High |
| `JSONB` | 12 | Oracle `JSON`-validated CLOB/BLOB or native JSON strategy, centralized serialization | High |
| `TIMESTAMPTZ` | 35 | `TIMESTAMP WITH TIME ZONE`; normalize driver result handling | High |
| `UUID` / `gen_random_uuid()` | 85 / 23 | `RAW(16)` or `VARCHAR2(36)` policy; generate UUIDs in application or Oracle function | High |
| `::type` casts | 12 active occurrences (`time`, `text`, `int`, `jsonb`, `regclass`) | explicit Oracle conversions; remove catalog-only cast | High |
| `INTERVAL` | 1 SQL query (cleanup) | interval arithmetic / `NUMTODSINTERVAL` in later rewrite | High |
| `information_schema` | 1 | Oracle data dictionary (`USER_TABLES`) only in migration tooling | High |
| `pg_constraint` / `regclass` | 1 / 1 | replace with Oracle dictionary or remove from repeatable DDL workflow | Critical |
| `ADD COLUMN IF NOT EXISTS` | 38 | versioned migration ledger; dictionary pre-check if needed | Critical |
| `CREATE INDEX IF NOT EXISTS` | 25 | migration ledger/dictionary pre-check | High |
| partial index | 1 | function-based index or query/schema redesign | High |
| PostgreSQL boolean DDL | 17 active table definitions/alterations | choose `NUMBER(1)` + constraints (portable Oracle strategy) and adapter mapping | High |
| `ILIKE`, `ANY`, `ARRAY`, `unnest`, `OFFSET` | 0 found in active direct-query sources | no action currently | Low |

Static `.sql` artifacts add 24 `CREATE TABLE`, 14 `ALTER TABLE`, 44 `CREATE INDEX`, 4 `JSONB`, 36 `TIMESTAMPTZ`, 50 `UUID`, 13 `gen_random_uuid`, 11 casts, and a Supabase/PostgreSQL policy/function model. They must not be executed against Oracle.

## 6. Schema Inventory

Active schema source of truth is the accumulated DDL in `lib/db.ts`; its creation order and historical `ALTER`s mean the final shape below supersedes the older CockroachDB artifact where they differ.

| Table | PK / important FKs and delete behavior | Constraints, defaults, nullable / special columns | Domain |
|---|---|---|---|
| `users` | `id` UUID; parent of most tables | unique `email`, `username`; role check; `password_changed` boolean false; `created_at` TZ timestamp | Auth/Admin |
| `courses` | text `id`; `instructor_id -> users` RESTRICT | enrollment/review booleans; optional code; created/updated TZ timestamps | Courses |
| `course_levels` | UUID `id` | unique value; integer sort; created timestamp | Course levels |
| `course_enrollments` | UUID `id`; course/users CASCADE | unique `(course_id, student_id)`; progress 0–100; timestamp | Enrollment |
| `course_announcements` | UUID `id`; course CASCADE, author/users RESTRICT | title/body; timestamps | Announcements |
| `chapters` | text `id`; course CASCADE | published/locked booleans; sort; timestamps | Content |
| `topics` | text `id`; chapter CASCADE | published/locked booleans; sort; timestamps | Content |
| `lessons` | text `id`; topic CASCADE; optional course CASCADE | nullable video; published/locked booleans; sort; timestamps | Content |
| `lesson_segments` | text `id`; lesson CASCADE | duration text; sort | Content |
| `assignments` | text `id`; course CASCADE, lesson CASCADE nullable, creator/users RESTRICT | type/points checks; DATE due date; 8 configuration booleans/text/integers; open/close TZ timestamps | Assignments |
| `quiz_questions` | UUID `id`; assignment CASCADE | type/index checks; `options`, `correct_indices`, `matching_pairs` JSONB; required boolean; numeric points | Quiz |
| `submissions` | UUID `id`; assignment/users CASCADE | type/score checks; `answers`, `question_scores` JSONB; score/previous_score numeric; manually-graded boolean; timestamp | Submissions/scoring |
| `meetings` | text `id`; creator/users RESTRICT | subject/URL/passcode; start/end/created TZ timestamps | Legacy meetings |
| `private_lesson_requests` | UUID `id`; student/users, teacher/users, course CASCADE; live class SET NULL | `requested_slots` JSONB; status/duration checks; requested/confirmed/timestamps | Private lessons |
| `teacher_private_lesson_availability` | composite `(teacher_id, weekday)`; teacher/users CASCADE | weekday/time-range checks; availability boolean; `TIME` fields; timestamp | Teacher availability |
| `student_lesson_completions` | UUID `id`; student/users, lesson CASCADE | unique `(student_id, lesson_id)`; timestamp | Progress |
| `live_classes` | UUID `id`; course CASCADE; lesson SET NULL; host/users CASCADE | unique room; active boolean; scheduled/created/updated TZ timestamps | Jitsi live classes |
| `live_class_participants` | UUID `id`; live class/users CASCADE | unique `(live_class_id, user_id)`; joined/left TZ timestamps | Live attendance |
| `lesson_live_broadcasts` | `lesson_id` text PK -> lessons CASCADE; starter/users SET NULL | active boolean; optional YouTube ID; timestamps | Broadcasts |

Indexes are concentrated on FK/filter/sort paths. The active DDL contains 25 idempotent index commands, including the one partial index `idx_lesson_live_broadcasts_active ... WHERE is_live = TRUE`. Legacy `optimize-indexes.sql` adds 14 more manually run indexes. Preserve index intent; do not blindly replay either set.

## 7. Foreign-key Dependency Map and Safe Import Order

```text
users
├── courses
│   ├── course_enrollments
│   ├── course_announcements
│   ├── chapters → topics → lessons → lesson_segments
│   │                              ├── student_lesson_completions (also users)
│   │                              └── lesson_live_broadcasts (also users)
│   ├── assignments → quiz_questions
│   │                └── submissions (also users)
│   ├── private_lesson_requests (also users; later references live_classes)
│   └── live_classes → live_class_participants (also users)
├── course_enrollments / announcements / assignments / submissions
├── meetings
└── teacher_private_lesson_availability

course_levels (independent)
```

Safe creation/import order: `users`, `course_levels`, `courses`, `chapters`, `topics`, `lessons`, `lesson_segments`, `assignments`, `quiz_questions`, `course_enrollments`, `course_announcements`, `submissions`, `meetings`, `teacher_private_lesson_availability`, `student_lesson_completions`, `live_classes`, `live_class_participants`, `lesson_live_broadcasts`, then `private_lesson_requests` (or create it earlier without its `live_class_id` FK and add that FK after `live_classes`). Load parent rows before children, then indexes and constraints after data validation when appropriate.

## 8. Query Complexity Classification

| Category | Files / query shape | Count |
|---|---|---:|
| A — easy | health, login, me, password; simple user/course-level CRUD | 7 files / 15 call sites |
| B — moderate | data aggregation, content CRUD, catalog, submissions and standard live-class reads | 13 files / 72 call sites |
| C — Oracle rewrite required | DDL/catalog, casts, `RETURNING`, UPSERT, `UPDATE FROM` / `DELETE USING`, partial index | 19 files / 119 call sites |
| D — redesign/high risk | runtime migration; assignment deletion/scoring; private lessons/cleanup; availability; broadcast; completion progress | 7 files / 45 call sites |

Counts are primary classifications of 251 call sites and are intentionally mutually exclusive; a file may appear in more than one class in later implementation because it has mixed queries.

## 9. Transaction Audit

| File / route | Purpose, tables, statements | Rollback / risk |
|---|---|---|
| `assignments/route.ts` DELETE | lock assignment (`FOR UPDATE`), delete submissions, delete assignment | explicit client `BEGIN`/`COMMIT`; rolls back authorization/not-found/errors; **CRITICAL** |
| `private-lesson-availability/route.ts` PUT | write seven availability rows | explicit client transaction, per-day UPSERT, rollback on failure; **HIGH** |
| `private-lesson-requests/route.ts` PUT accepted | update request, read student, create live class, link request | explicit client transaction with rollback; **CRITICAL** |
| `lesson-live/route.ts` POST | deactivate prior broadcast, UPSERT current broadcast | calls `BEGIN`/`COMMIT`/`ROLLBACK` on `pool`, not a dedicated checked-out client; session affinity is unsafe with pooling and must be redesigned before migration; **CRITICAL** |
| `lib/privateLessonRequests.ts` cleanup | CTE deletes expired requests then linked rooms | one atomic SQL statement, no explicit transaction; **HIGH** |

Routes that should be considered for future transactional treatment: assignment POST/PUT (assignment plus N questions), submission POST/PUT (state validation plus write), enrollment/progress update in `lessons/complete`, and private request non-accept updates that delete a linked room. This is a future design finding only.

## 10. UPSERT Audit

| File | Table / key | Current behavior | Future Oracle strategy |
|---|---|---|---|
| `courses/enroll/route.ts` | `course_enrollments(course_id, student_id)` | three `DO NOTHING` paths | `MERGE` with no update or insert with duplicate-key handling |
| `lessons/complete/route.ts` | `student_lesson_completions(student_id, lesson_id)` | `DO NOTHING`, then recalculates enrollment progress | transaction: merge completion then calculate/write progress |
| `private-lesson-availability/route.ts` | `(teacher_id, weekday)` | `DO UPDATE` time/availability | `MERGE` within existing transaction |
| `live-classes/[id]/join/route.ts` | `(live_class_id, user_id)` | update `joined_at`, clear `left_at`, return row | `MERGE` plus a separate fetch or Oracle returning approach |
| `lesson-live/route.ts` | `lesson_live_broadcasts(lesson_id)` | update live state / video / timestamps | dedicated-client transaction + `MERGE`; preserve single-active-broadcast rule |

## 11. JSON Audit

### JSON

| Table.column | Structure / use | Files | Risk |
|---|---|---|---|
| `quiz_questions.options` | array of choices | assignments, data | JSON serialization and driver decoding vary |
| `quiz_questions.correct_indices` | array of correct choice indexes | assignments, data, scoring | high: legacy string-or-array handling |
| `quiz_questions.matching_pairs` | matching-pair structure | assignments, data, scoring | high |
| `submissions.answers` | quiz answers, legacy string-or-object/array parsing | submissions, assignments, data, scoring | critical: feeds grading |
| `submissions.question_scores` | numeric score array | submissions, assignments, data | high |
| `private_lesson_requests.requested_slots` | requested timeslot array | private-lesson requests | high |

All JSON defaults in active DDL are `[]`/`'[]'::jsonb`. Future Phase 1 should define one application JSON encode/decode boundary and validate each document shape; do not depend on `pg` auto-decoding.

## 12. Date/Time Audit

- `TIMESTAMPTZ` is used for all audit times, course/assignment windows, submissions, private lessons, live classes, broadcasts, and meetings. `DATE` is used for assignment due dates; availability uses `TIME`.
- Application inputs are frequently converted through `new Date(...).toISOString()`. `submissions/route.ts` constructs due-date deadline as `new Date(YYYY-MM-DDT23:59:59)` without a zone, so server/client timezone can affect closure. The intended business timezone is not encoded in schema or SQL.
- Cleanup adds `(duration_minutes + 10) * INTERVAL '1 minute'` to `confirmed_at`; this needs explicit Oracle interval arithmetic.
- Recommended future policy: retain instants as `TIMESTAMP WITH TIME ZONE`, treat date-only due dates as a named business-timezone rule chosen by product owners, and test Thailand/UTC boundary cases before cutover.

## 13. Boolean Audit

Active boolean columns: `users.password_changed`; course enrollment/review settings; published/locked content flags; assignment visibility/submission flags; `quiz_questions.is_required`; `submissions.is_manually_graded`; availability; `live_classes.is_active`; broadcasts `is_live`. SQL uses `TRUE`/`FALSE`, comparisons, defaults, and a partial-index predicate.

Recommended future Oracle strategy: represent persisted booleans consistently as `NUMBER(1)` constrained to `(0,1)` and map at a central adapter boundary. This avoids coupling the migration to Oracle version/driver native-BOOLEAN behavior and requires query rewrites in Phase 1.

## 14. Migration Code Audit and Dead/Duplicate Candidates

`lib/db.ts` contains the pool, health/catalog checks, full table creation, incremental `ALTER`s, catalog-driven dynamic constraint dropping (`${row.conname}`), index creation, and table verification. It is both a connection module and an unversioned, repeatable migration engine.

`scripts/migrate.cjs` transpiles TypeScript at execution time and imports it through Node's internal `Module` API. `package.json` declares `"build": "npm run db:migrate && next build"`; therefore builds require a reachable writable Cockroach/PostgreSQL database. For Vercel/serverless this risks concurrent deployment DDL, deployment failure when the database/network/wallet is unavailable, and no controlled migration history. Oracle Autonomous migrations must be separated into an explicit, serialized deployment pipeline before Phase 1.

Candidates to review later (do not delete in Phase 0):

- `cockroachdb_schema.sql` is older than active `lib/db.ts` (for example it lacks hierarchy/announcement/private-lesson/broadcast evolution).
- `sql/create_live_classes.sql` duplicates live class tables/indexes also present in `lib/db.ts` and `cockroachdb_schema.sql`.
- `optimize-indexes.sql` duplicates/adds indexes separately from runtime DDL; it also contains `ANALYZE` commands.
- `fix-score-column.sql` is a manual Cockroach repair and conflicts with the current inline `NUMERIC` schema/history.
- `supabase_schema.sql` and `supabase/*.sql` describe a distinct historical Supabase/Auth/RLS model (`profiles`, policies, PL/pgSQL), not the active `users`/`pg` runtime model.
- `ensureTables()` is a compatibility no-op called broadly; it is not runtime schema setup despite its name.
- `profiles/route.ts` has dynamic SQL construction for the `SET` clause. Values are bound, but its dynamic placeholder generation must be redesigned/tested with Oracle named binds.

## 15. Application Domain Map

| Domain | Tables / primary files | Approx. calls | Complexity / order |
|---|---|---:|---|
| Auth/Admin | users; auth routes, profiles, admin users | 14 | Medium; first |
| Course levels/courses/enrollment | course_levels, courses, enrollments; levels/courses/enroll | 14 | High; second |
| Content hierarchy | chapters, topics, lessons, segments, completions | 28 | High; third |
| Announcements | announcements, courses/enrollments | 6 | High; after courses |
| Assignments/quiz | assignments, quiz_questions | 22 | Critical; after hierarchy |
| Submissions/scoring | submissions plus assignments/questions | 12 | Critical; after quiz |
| Dashboard/catalog | read model across nearly all core tables | 17 | High; migrate after underlying domains |
| Private lessons | requests, availability, live classes | 24 | Critical; late |
| Live classes/broadcasts | live classes/participants/broadcasts | 27 | Critical; late |
| Operations | health, cron cleanup, migration runner | 2 direct + runner | Critical; establish before cutover |

## 16. Oracle Migration Risk Register

| Risk | Severity | Why / area | Mitigation |
|---|---|---|---|
| Build executes DDL | Critical | Vercel/serverless build invokes mutable schema code | external, serialized, versioned migration pipeline |
| Schema drift / duplicate sources | Critical | runtime DDL, Cockroach schema, live-class SQL, and Supabase schema disagree | nominate one canonical final schema and reconcile data |
| UUID representation | High | 19 tables use UUID relationships/default generators | choose `RAW(16)` vs `VARCHAR2(36)`, document conversion and indexing |
| JSON grading data | Critical | answers/scores affect academic outcomes | schema validation, compatibility fixtures, score parity tests |
| Transaction session affinity | Critical | broadcast transaction uses `pool.query` | use acquired connection and explicit transaction helper |
| UPSERT / `RETURNING` | High | enrollment, availability, attendance, broadcasts, IDs | per-route `MERGE`/exception/return strategy and concurrency tests |
| PostgreSQL DML forms | High | `UPDATE FROM`, `DELETE USING`, CTE deletes, casts | rewrite individually and test results/authorization |
| Timezone/date-only semantics | High | deadlines, scheduled classes, cleanup | choose business zone rules and test DST/UTC/Thailand boundaries |
| Boolean semantics | High | defaults/filters/partial index depend on booleans | `NUMBER(1)` policy with centralized mapping |
| Oracle Autonomous connectivity | High | wallet/TLS/pooling lifecycle differs from `pg` URL/SSL | configure later outside build, test serverless pooling and secrets |
| Result behavior | Medium | code assumes `rows`, `rowCount`, automatic JSON parsing | adapter normalizes result shape and values |

## 17. Recommended Migration Order

1. Establish a database abstraction/transaction/result/JSON/date boundary and external migration pipeline.
2. Migrate canonical schema foundations: users, course levels, courses, indexes, and ID strategy.
3. Migrate enrollments and course announcements.
4. Migrate chapters, topics, lessons, segments, and progress/completions.
5. Migrate assignments and quiz questions with JSON fixtures.
6. Migrate submissions/scoring and validate grading parity.
7. Migrate dashboard/catalog read paths after their tables are stable.
8. Migrate private availability and requests, then live classes/participants and broadcasts.
9. Migrate cron cleanup, health, deployment workflow, and perform integration/concurrency/load tests.

This follows foreign-key order, isolates high-value grading data, and postpones the most concurrency-sensitive scheduling/live features until shared adapter behavior is proven.

## 18. Files Requiring Changes in Later Phases

- [ ] Platform/migration: `package.json`, `package-lock.json`, `lib/db.ts`, `scripts/migrate.cjs`, `cockroachdb_schema.sql`, `sql/create_live_classes.sql`, `optimize-indexes.sql`, `fix-score-column.sql`.
- [ ] Access/result foundation: every direct-query route in the inventory, beginning with auth/profile/courses/levels.
- [ ] Content and learning: `app/api/{chapters,topics,lessons,lessons/complete,assignments,submissions,data,public/catalog}/route.ts`.
- [ ] Scheduling/live: `lib/privateLessonRequests.ts`, `app/api/{private-lesson-availability,private-lesson-requests,lesson-live,live-classes}/**/route.ts`, and `app/api/cron/private-lesson-cleanup/route.ts`.
- [ ] Historical artifacts to explicitly retain/archive/retire after reconciliation: `supabase_schema.sql`, `supabase/profiles-rls.sql`, `supabase/allow-read-profiles.sql`.

## 19. Appendix: SQL/Search Findings and Limitations

Validation re-ran searches for `pool.query`, `client.query`, `$n` parameter patterns, `ON CONFLICT`, `RETURNING`, `JSONB`, `::` casts, `pg_`, `information_schema`, `BEGIN`, `COMMIT`, and `ROLLBACK`. All 30 direct runtime-query files are listed above. No `.sql` file was executed and no production configuration was changed.

Limitations:

- Exact runtime statement executions cannot be fixed statically because requests contain loops, conditionals, and dynamic queries.
- No live database/catalog/data inspection was performed; nullable state and historical schemas are derived from source only.
- Static Supabase artifacts are historical and not necessarily deployed; they are catalogued to avoid accidental Oracle replay.

## Phase 1 Readiness

- [x] All database access files identified
- [x] SQL usage counted
- [x] PostgreSQL-specific syntax identified
- [x] Tables and relationships documented
- [x] Transactions documented
- [x] UPSERT operations documented
- [x] JSON fields documented
- [x] Date/time risks documented
- [x] Migration script behavior documented
- [x] Migration order defined
- [x] High-risk areas identified

Phase 1 must begin with design review of the canonical schema, UUID/boolean/JSON policies, and migration deployment pipeline. It must not begin by changing production configuration.
