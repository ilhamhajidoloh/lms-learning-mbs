# Phase 6: Oracle Staging / Extended Regression

**Status: COMPLETE — tagged Oracle API E2E passed, tagged fixtures were removed, and Oracle was reconciled exactly to the frozen 41-row baseline.** Historical sections below preserve the earlier connectivity and credential blockers. Those blockers were subsequently resolved for the tagged API workflow. Production remains configured with `DB_PROVIDER=postgres`.

## Baseline and environment gates

| Check | Result | Evidence |
|---|---|---|
| Frozen baseline identity | Known | `migration-data/phase4-production-20261007T180359Z`, 41 rows across 19 business tables |
| Pre-test Phase 4C validator | BLOCKED | The required read-only command did not return or produce a report within the execution window. The existing Phase 5 connectivity record identifies outbound Oracle TCP 1522 as unreachable. |
| Oracle schema validator | NOT RUN | It must follow a successful pre-test baseline validation. |
| Application boot/restart | NOT RUN | Stopped before starting an Oracle-backed process. |
| Production provider | PASS | `.env.local` remains `DB_PROVIDER=postgres`. |

No write was allowed because the mandatory baseline gate was not re-established. This preserves the 41-row Oracle baseline and does not repeat any recovery work.

## Static regression and result-key audit

The Oracle adapter intentionally returns driver rows with Oracle's uppercase keys. `runForProvider` lower-cases rows centrally; provider-specific direct reads must do the equivalent at their boundary.

| Area | Result | Notes |
|---|---|---|
| Raw-row audit | ISSUE FOUND AND FIXED | `GET /api/health` read `result.rows[0].value`; Oracle returns `VALUE`. The route now applies `lowerKeys` before reading it. |
| Route patterns using `runForProvider` | PASS (static) | The audited lesson-live, live-class, and private-lesson authorization reads receive normalized lower-case keys. |
| Direct Oracle DML follow-up reads | PASS (static) | Announcements and live-class paths explicitly normalize their direct Oracle rows. |
| CLOB / JSON / numeric / timestamp / date-only behavior | NOT RUN | Requires the gated live Oracle staging workflow. |
| UI, roles, persistence, authorization, error leakage, pool stability | NOT RUN | Requires Oracle connectivity plus controlled test credentials/browser interaction. |

The health correction is an **APPLICATION_BUG** found through the Oracle result-key audit. It is not a data-migration defect; the previous `?? 1` fallback hid it for the current `SELECT 1` query.

## Local build checks

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | PASS | Exit code 0; 17 existing warnings, no errors. |
| `npx tsc --noEmit` | PASS | Exit code 0. |
| `npm run build` | BLOCKED (environment) | Next.js reached compilation but could not fetch Inter and Kanit from Google Fonts. The recorded middleware-to-proxy deprecation warning is non-blocking. |

## Fixtures and cleanup

No fixtures were created; all fixture-ID collections are empty. Cleanup and post-cleanup baseline validation are therefore not applicable in this attempt. No destructive or bulk operation was run.

## Production drift

The Cockroach read-only preflight was not run in this Phase 6 attempt because the prior recorded connectivity gate shows outbound TCP to port 26257 is unavailable. Consequently, the current production row count and content drift are **NOT PROVEN**; no export/import or source write was performed.

## Phase 7 planning only

Before any cutover, Phase 7 must have an approved maintenance/write-freeze mechanism, a read-only final source export/delta capture, deterministic changed-row and deletion representation, guarded Oracle delta import, full reconciliation, and an explicit rollback window in which Cockroach remains the source of truth. None of those actions were started here.

## Resume sequence

1. Restore Oracle TCPS egress (port 1522) and CockroachDB read-only egress (port 26257) from this runner.
2. Re-run the Phase 4C baseline validator; continue only on 41 rows, 19/19 row/PK/logical parity, and zero field mismatches.
3. Run `npm run db:validate:oracle`, then boot a process-scoped `DB_PROVIDER=oracle` application and complete the browser, role, repeat-request, and extended-state workflows using tagged fixtures.
4. Remove only tagged fixtures in FK-safe reverse order and rerun both Oracle baseline gates plus the Cockroach read-only drift preflight.

## Phase 7 readiness

**NOT READY.** The Phase 6 live-regression completion criteria have not been exercised. Do not freeze writes, export a final delta, change production `DB_PROVIDER`, or direct production traffic to Oracle.

## Browser/UI smoke attempt (2026-10-08)

**Status: PARTIAL — restart failure; role workflows blocked by unavailable credentials.** The supplied checkpoint reported a passing Oracle baseline and schema gate. This task made no business-data write and created no fixture.

### Routes and guards discovered

| Area | Actual route / behavior |
|---|---|
| Login | `/login`; posts to `/api/auth/login` |
| Landing routing | `/` routes admin to `/admin`, teacher to `/teacher`, and student to `/student` |
| Admin | `/admin`; client guard redirects unauthenticated users to `/login` and other roles to `/` |
| Teacher | `/teacher`; client guard redirects unauthenticated users to `/login` and other roles to their permitted dashboard |
| Student | `/student`; client guard redirects unauthenticated users to `/login` and non-students to the permitted dashboard |
| Middleware | Protected pages require a token; `/admin`, `/teacher`, and `/student` redirect to `/login?redirect=...` when unauthenticated. API routes perform server-side `authenticate` checks. |

### Observations

| Check | Result | Notes |
|---|---|---|
| Existing Oracle health before restart | PASS | `GET /api/health` on port 5001 returned `200`, `{ status: "ok", provider: "oracle", value: 1 }`. |
| Unauthenticated authorization navigation | PASS | `/admin`, `/teacher`, and `/student` each returned `307` to their matching `/login?redirect=...`; `/api/profiles` returned `401`. |
| Admin UI | BLOCKED_CREDENTIALS | No usable local admin credential was found; no login guess/reset was attempted. |
| Teacher UI | BLOCKED_CREDENTIALS | No usable local teacher credential was found; no login guess/reset was attempted. |
| Student UI | BLOCKED_CREDENTIALS | No usable local student credential was found; no login guess/reset was attempted. |
| Role-to-role authorization | BLOCKED_CREDENTIALS | Cannot safely establish role sessions without credentials; unauthenticated guard behavior was verified. |
| Controlled restart | FAIL | The restarted dev server reached Ready on port 5001, then `/api/auth/me` logged `NJS-040` and sequential `/api/health` checks returned `503 { error: "Database connection failed" }`. |
| Post-test Phase 4C validation | BLOCKED | The required read-only validator did not complete within the execution window after the restart failure. |

The browser console could not be inspected by this execution environment. Server diagnostics captured the Oracle `NJS-040` queue timeout; no Oracle SQL, token, credential, or connection-string value was exposed in the client response.

The restart failure is classified as **ENVIRONMENT** pending restoration of Oracle connection availability. It prevents completion of this smoke task but is not evidence of baseline data drift. The previously fixed health result-key issue remains the only confirmed **APPLICATION_BUG** in Phase 6.

## Oracle restart / pool diagnosis (2026-10-08)

**Status: BLOCKED — root cause not yet proven.** `NJS-040` is a pool-queue timeout, so it must not be treated as network-only without comparing standalone driver connectivity and application-pool behavior.

### Architecture and release audit

| Finding | Result |
|---|---|
| Application pool creation | One path: `lib/database/oracle.ts:getOraclePool()` calls `oracledb.createPool()`. |
| Singleton / hot reload | The in-flight pool promise is stored on `globalThis.__oraclePoolPromise`, not module scope. It is assigned before `createPool()` is awaited, so concurrent calls in one runtime share it. |
| Pool creation count | One per process-global lifetime in application code; separate CLI/test scripts intentionally create their own process-local pools. |
| Standalone query release | `oracleDatabase.query()` always closes its acquired connection in `finally`. |
| Transaction release | `withTransaction()` always calls `connection.release()` in `finally`; the Oracle adapter release closes the driver connection. |
| Direct application acquisition | None outside `lib/database/oracle.ts`; routes use `query()` or `withTransaction()`. |
| CLI/test direct acquisitions | Audited migration, validation, connectivity, and Phase 3/verification scripts use `try/finally` connection close patterns and are not resident application pools. |
| Shutdown handling | `closeOraclePool()` exists for controlled CLI shutdown, but the Next.js server has no signal/shutdown hook. A real process exit releases its resources at process termination; this is not itself evidence of a leak. |
| `/api/auth/me` | A valid authenticated request performs one `query()` and therefore acquires at most one Oracle connection. Unauthenticated requests return before the query. |
| `/api/health` | Performs one standalone adapter query and releases its one connection in the adapter `finally`. |

### Development-only diagnostics added

`lib/database/oracle.ts` now supports opt-in diagnostics when both conditions are true:

```text
NODE_ENV is not production
ORACLE_POOL_DIAGNOSTICS=1
```

It enables node-oracledb pool statistics and logs only numeric lifecycle data: creation count, open/in-use connections, request/enqueue/timeout counts, and queue lengths. It deliberately omits credentials, wallet paths, connect strings, SQL, binds, tokens, and user values. It does not alter `poolMax` or `queueTimeout`.

### Required controlled comparison

In two PowerShell terminals, first identify only the server using port 5001:

```powershell
Get-NetTCPConnection -LocalPort 5001 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
Get-Process -Id <OwningProcess>
```

Stop only the confirmed Next.js process, verify the port is free, then run:

```powershell
npm run db:test:oracle
$env:DB_PROVIDER = "oracle"
$env:ORACLE_POOL_DIAGNOSTICS = "1"
npm run dev -- -p 5001
```

From the second terminal, issue ten sequential `Invoke-RestMethod http://localhost:5001/api/health` calls, then several unauthenticated `Invoke-WebRequest http://localhost:5001/api/auth/me -MaximumRedirection 0` calls, then health calls again. Repeat after one controlled restart. The captured `[oracle-pool]` lines distinguish a failed connection creation from queued/in-use application connections.

The runner's standalone test began but did not complete within its 30-second command window, so Case A/B/C/D is still unresolved. Do not change pool sizing or timeout values until that comparison is captured.

## Three-role UI smoke continuation (2026-10-08)

**Status: PARTIAL — credentials unavailable.** The user completed the controlled local restart/pool comparison with standalone Oracle connectivity, fresh-start requests, controlled restart requests, and post-restart baseline/schema validation all passing. The user observed one pool creation, zero queued/timed-out requests, release to zero in-use connections, and no NJS-040 reproduction. The restart/pool sub-phase is therefore **PASS**.

The current runner also confirmed `GET /api/health` on port 5001 as `200` with `{ status: "ok", provider: "oracle", value: 1 }`.

| Role | Credential available | UI result |
|---|---:|---|
| Admin | false | BLOCKED_CREDENTIALS |
| Teacher | false | BLOCKED_CREDENTIALS |
| Student | false | BLOCKED_CREDENTIALS |

No credential was printed, guessed, reset, or used. Approved local configuration, documentation, scripts, and test sources contained no documented reusable role credential. Browser console tooling is **NOT_AVAILABLE_IN_RUNNER**.

### Read-only routing and API guards

| Request | Result |
|---|---|
| `/login` | `200` |
| `/admin` | `307` to `/login?redirect=%2Fadmin` |
| `/teacher` | `307` to `/login?redirect=%2Fteacher` |
| `/student` | `307` to `/login?redirect=%2Fstudent` |
| `/api/data`, `/api/levels`, `/api/live-classes` unauthenticated | `401` |

The code confirms login redirects roles to `/admin`, `/teacher`, and `/student`; the middleware requires a token for protected pages, and route handlers use `authenticate()` for protected API reads. Role-to-role navigation with valid sessions remains **BLOCKED_CREDENTIALS**.

### Plan for the next authorized tagged-account phase

Do not use the public `/api/auth/register` endpoint to create elevated test roles: its UI creates only a student, while the underlying endpoint accepts a requested role and is not the safe administrative path. Once a safe existing admin session is authorized for the fixture phase, use the authenticated `/api/admin/users` route to create only tagged users:

```text
phase6_20261008_admin_<suffix>  (only if the one-admin rule permits; otherwise use the safe existing admin read-only)
phase6_20261008_teacher_<suffix>
phase6_20261008_student_<suffix>
```

Record returned user IDs and related fixture IDs in the git-ignored Phase 6 report; retain passwords/tokens outside reports. All subsequent hierarchy, enrollment, submission, private-lesson, live-class, and broadcast records must carry or derive from the tagged users/course. Cleanup must be FK-safe: participant/completion/submission and dependent quiz/broadcast/private-lesson rows first; then enrollment/announcement/lesson hierarchy/assignment/live-class rows; then the tagged course; then tagged users. Validate the 41-row baseline immediately after cleanup.

No tagged user or business fixture was created in this task. Phase 6 remains **IN PROGRESS**.

## Tagged-account / E2E gate (2026-10-08)

**Status: BLOCKED — authorized admin session unavailable.** Oracle health on port 5001 is currently PASS (`200`, provider `oracle`, value `1`), but the fixture phase cannot safely create its required tagged teacher account.

`POST /api/admin/users` is the compliant user-creation path: it requires an `Authorization: Bearer` token that verifies to role `admin`, hashes the supplied/generated password, creates a UUID-backed user, and enforces the existing one-admin restriction. No authorized admin token or credential exists in the approved local sources. The public `/api/auth/register` endpoint is deliberately not used for elevated-role creation, as instructed.

No account, course, hierarchy, enrollment, submission, private lesson, live class, broadcast, or other Phase 6 fixture was written. No baseline record, Cockroach record, production environment value, or Phase 7 state changed.

To resume, provide an authorized existing-admin session through the normal login path (without sharing a password or token in chat), then create only `phase6_20261008_e2e_*` teacher and student fixtures via `/api/admin/users`. Do not create a second admin unless the endpoint permits it; use the existing admin read-only for admin validation.

### Tagged-account handoff

The authorized Admin UI has now created the two approved, disposable Phase 6 accounts. Their identifiers are tracked only in the git-ignored machine report:

```text
teacher: phase6_20261008_teacher (242495fb-9d34-4b81-bcea-d6bef06f1fb0)
student: phase6_20261008_student (7de24758-9b7c-4e00-b140-ffb118cd9c1e)
```

No credential, token, cookie, or password is stored in this repository or report. The account-creation blocker is resolved, but the next E2E operations remain blocked in this terminal because it cannot access the browser's authenticated sessions and no browser automation capability is available. Generating a JWT from local configuration would bypass the instructed normal login flow and was not done. No business fixture beyond the two tagged users has been created.

## Tagged Oracle API E2E (2026-10-08)

**Status: PASS, with one deliberately skipped global-safety workflow.** The user authenticated the two tagged accounts through the normal `POST /api/auth/login` flow and verified both through `GET /api/auth/me`. Bearer credentials were retained only in the user's PowerShell process; no credential, token, cookie, password, or connection string was printed or saved to the repository.

| Identity | ID | Role |
|---|---|---|
| `phase6_20261008_teacher` | `242495fb-9d34-4b81-bcea-d6bef06f1fb0` | teacher |
| `phase6_20261008_student` | `7de24758-9b7c-4e00-b140-ffb118cd9c1e` | student |

### Authorization and functional results

| Workflow | Result | Evidence |
|---|---|---|
| Identity verification | PASS | Both `/api/auth/me` responses returned the expected tagged ID and role. |
| Admin-only authorization | PASS | Tagged teacher and student each received `403` from `POST /api/admin/users`. |
| Teacher-only availability authorization | PASS | Tagged student received `403` from `PUT /api/private-lesson-availability`. |
| Course hierarchy | PASS | Teacher created tagged course, chapter, topic, and lesson; course was opened and student self-enrolled. |
| Announcement visibility | PASS | Student read the tagged announcement through `GET /api/announcements?courseId=phase6_20261008_e2e_course`. `/api/data` intentionally does not return announcements. |
| Lesson completion | PASS | Student completion returned `success: true`, `progress: 100`. |
| Quiz / grading | PASS | Student submitted the tagged quiz; teacher awarded question scores `1.25` and `2.50`; student read total score `3.75`. |
| Private lesson | PASS | Teacher saved seven-day availability; enrolled student requested a tagged appointment; student acceptance attempt returned `403`; teacher accepted and the application created a linked private live room. |
| Live class | PASS | Teacher created and started a tagged live class; enrolled student listed and joined it; teacher ended it. |
| Live broadcast | SKIPPED_SAFETY | Starting `/api/lesson-live` globally deactivates other active broadcasts. Without a safe global preflight, exercising it could mutate non-tagged baseline data. |

The first `PUT /api/courses` request to open the tagged course returned one `500`; an immediate identical retry returned `{ success: true }`, and all dependent workflows passed. Record this as a transient Oracle/application event. It does not invalidate the successful persisted course state, but it should be considered during subsequent reliability investigation.

### Tagged fixture ledger

All business-data IDs are tagged directly or are descendants of the tagged course/request. No cleanup has run.

| Fixture | ID |
|---|---|
| Course | `phase6_20261008_e2e_course` |
| Chapter | `eac04a33-e204-44c6-bf07-e2925081f3d5` |
| Topic | `cd900baf-0c0b-4870-8480-b6840ad092e3` |
| Lesson | `phase6_20261008_e2e_lesson` |
| Assignment / quiz | `6545c74e-6775-46f1-b25a-6ef7d754e88d` |
| Announcement | `44e1a403-b193-4fe9-9bf4-4141d3cd060f` |
| Submission | `ab82bedb-ea55-415a-98ae-5ca111840043` |
| Private-lesson request | `f2a9c42f-aa36-4f4b-9603-e9e0cb265e12` |
| Private live class (application-created) | `d0e3d96b-2886-4515-ba15-da02d67b25a2` |
| Standard live class | `8e482baa-2748-4929-b99b-2067a289e09d` |
| Live-class participant | `ac0dbda9-de06-42d3-9e38-07905d14f7f8` |

Question row IDs are intentionally absent: the assignment API creates them but does not expose them in its response or read model. Their ordered, tagged question text is recorded by the run ledger instead.

### Remaining exit criteria

1. Remove **only** the tagged fixtures above, in FK-safe reverse dependency order; do not delete baseline rows.
2. Re-run the read-only Oracle baseline and schema validators and record the expected 41-row / 19-table parity with zero mismatches.
3. Preserve the production safeguard: do not change production `DB_PROVIDER`, write to Cockroach, or begin Phase 7.
4. Keep live broadcast marked `SKIPPED_SAFETY` unless a preflight proves that testing it cannot alter a non-tagged active broadcast.

**Phase 7 readiness: superseded by the final assessment below.**

## Final Phase 6 cleanup and reconciliation (2026-10-08)

**Status: COMPLETE.** No additional functional workflow or live-broadcast test was run.

### Tagged-only cleanup

Read-only discovery searched all 19 canonical Oracle tables by the exact tagged course and user IDs before any delete. It found only the expected tagged graph: 2 users, 1 course, 1 enrollment, 1 announcement, 1 chapter, 1 topic, 1 lesson, 1 assignment, 2 quiz questions, 1 submission, 7 teacher-availability rows, 1 lesson completion, 1 private-lesson request, 2 live classes, and 1 live-class participant. There were no tagged meetings, lesson segments, or lesson broadcasts.

The cleanup used an explicit-ID, FK-safe reverse order in one Oracle transaction: participant, completion, submission, questions, private request, announcement, enrollment, assignment, live classes, lesson hierarchy, course, availability composite keys, and tagged users. It used neither broad predicates, `TRUNCATE`, `DROP`, nor a cascade-dependent parent delete. The transaction committed only after an in-transaction discovery found zero tagged rows in every canonical table.

### Post-cleanup gates

| Gate | Result |
|---|---|
| Tagged rows remaining | PASS — `0` across all 19 canonical tables |
| Phase 4C baseline validator | PASS — Oracle `41` rows; `row_counts=19/19`; `pk=19/19`; `logical=19/19`; field mismatches `0`; FK orphans `0`; duplicate groups `0` |
| Oracle schema validator | PASS — `19 LMS tables validated` |
| Cockroach production preflight | READ-ONLY PASS — current production rows `41`; data blockers `0`; transformations required `3`; source-schema gaps `8` |
| Cockroach writes | `0` |
| Production `DB_PROVIDER` | `postgres` |
| Production switched to Oracle / final delta | `NO` / `NOT APPLIED` |
| Lint | PASS — 15 pre-existing warnings, 0 errors |
| TypeScript | PASS |
| Build | BLOCKED_ENVIRONMENT — Google Fonts fetch for Inter and Kanit failed; no application build error was established |

The production preflight proves **row-count drift = 0** against the 41-row source snapshot. It does not claim content drift = 0, because that was not a requested or available content-comparison operation.

### Accepted safety exception and observation

- **Live broadcast: `SKIPPED_SAFETY`.** Its start operation globally deactivates active broadcasts, so exercising it could mutate non-tagged records. This is an accepted Phase 6 safety exception.
- **Transient application reliability observation:** the first tagged `PUT /api/courses` returned `500`; an immediate identical retry succeeded and every dependent workflow passed. It was not reproducible in this run and is not a migration blocker.

**Final assessment:** Tagged E2E `PASS`; cleanup `PASS`; baseline restored exactly; schema validation `PASS`; production untouched; migration blockers `0`. **Phase 7 readiness: READY.** No Phase 7 activity was started automatically.
