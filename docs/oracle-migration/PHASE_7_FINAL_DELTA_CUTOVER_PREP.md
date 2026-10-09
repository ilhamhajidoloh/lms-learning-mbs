# Phase 7 — Final Delta / Freeze Writes: Planning and Preflight

Status: planning and tooling only. No freeze was enabled, no final snapshot was captured, no delta was applied,
`DB_PROVIDER` is still `postgres`, Phase 8 has not started. Cockroach writes: 0. Oracle business-data writes: 0.

## 1. Existing tooling (reused, not duplicated)

| Need | Existing code | Phase 7 use |
|---|---|---|
| Source preflight + schema fingerprint | `scripts/migration/preflight-source.cjs` | before/after each capture, schema drift gate |
| Read-only export, NDJSON, per-file SHA256, logical checksums | `scripts/migration/export-cockroach.cjs` | wrapped by `export-phase7-final.cjs` |
| Canonical row normalization | `scripts/migration/lib/transform.cjs` | the only definition of "logical row" |
| FK order | `scripts/migration/lib/order.cjs`, manifest `order` | delete children-first, insert parents-first |
| Source gap policy | `scripts/migration/lib/source-gaps.cjs` | known gaps stay approved |
| Snapshot verification, row reading, INSERT SQL | `import-oracle.cjs` (`verifyExport`, `rows`, `insertSql`, `valueExpr`) | now exported; `main()` only runs when invoked directly |
| Oracle-side logical read-back | `validate-phase4c-import.cjs` (`selectExpr`, `oracleValue`) | target-drift check and post-apply check |
| Targeted cleanup/recovery | `cleanup-phase6-tagged.cjs` | pattern only (exact IDs, FK-safe order, one transaction) |

New: `lib/delta.cjs` (pure diff/classify logic), `export-phase7-final.cjs`, `compare-phase7-delta.cjs`,
`apply-phase7-delta.cjs`, `lib/writeFreeze.ts`, and three offline test scripts.
`validate-phase4c-import.cjs` gained an opt-in `--phase7` flag; default behaviour is unchanged (re-verified: PASS 19/19).

## 2. Baselines re-established (read-only)

- Oracle validator against the Phase 4 export: PASS, 41 rows, row_counts/pk/logical 19/19, field mismatches 0, FK orphans 0.
- `npm run db:validate:oracle`: 19 LMS tables validated.
- Cockroach production (read-only): 41 rows, schema fingerprint `8b6d0200…a231` identical to Phase 4,
  every preflight section (tables, columns, constraints, indexes, counts, audits) byte-identical to the Phase 4 preflight.
  Data blockers 0, transformations 3, known source gaps 8, warnings 3.
- A read-only preview export (`migration-data/phase7-preview-20261008T152808Z`, taken WITHOUT a freeze) compared by
  primary key and canonical logical row against the Phase 4 baseline: insert 0, update 0, delete 0, unchanged 41.
  Row counts and file hashes match, and the comparison above is content-based, not count-based.
  This preview is informational only. It proves the process works end to end; it is not the final delta and must not be applied
  (`apply-phase7-delta.cjs --execute` refuses anything not named `phase7-final-<timestamp>`).

## 3. Write-freeze design

Chosen: application-level flag, two layers, disabled by default. Order of preference was followed; DB-user permission reduction
and full outage were not needed.

1. `WRITE_FREEZE=1` (exactly `"1"`; `0`, `true`, `yes`, empty and unset are all OFF). Checked in `middleware.ts`, which answers every
   `POST/PUT/PATCH/DELETE` under `/api/` with `503`, `Retry-After: 300`, body code `MAINTENANCE_WRITE_FREEZE`.
   Reads, page navigation and `POST /api/auth/login` stay available (login verifies a password and signs a JWT; it issues no SQL write).
2. Backstop in both database adapters (`lib/database/postgres.ts`, `oracle.ts`): while frozen, any statement that is not
   SELECT/SHOW/EXPLAIN/read-only WITH (or BEGIN/COMMIT/ROLLBACK) throws. Every SQL statement in the app goes through
   `executePostgres`/`executeOracle` (verified: only `lib/db.ts` and the adapters import `pg`/`oracledb`).
3. `purgeExpiredPrivateLessonRequests()` returns 0 while frozen. It deletes rows, and it is called from `GET /api/private-lesson-requests`
   and from the Vercel cron `/api/cron/private-lesson-cleanup` (every 10 minutes). Without this, a GET or the cron would write during the window,
   or fail the read under layer 2. That is the one real write path the "POST/PUT/PATCH/DELETE only" view misses.

Needs no schema change and no `DB_PROVIDER` change; turn off by unsetting the variable.

### Route inventory (42 mutation handlers across 23 route files)

| Class | Handlers |
|---|---|
| WRITE (41) | admin/users POST; announcements POST PUT DELETE; assignments POST PUT DELETE; auth/password PUT; auth/register POST; chapters POST PUT DELETE; courses POST PUT; courses/enroll POST DELETE; lesson-live PUT; lessons POST PUT DELETE; lessons/complete POST; levels POST DELETE; live-classes POST; live-classes/[id] PATCH DELETE; live-classes/[id]/start, /end, /join POST; private-lesson-availability PUT; private-lesson-requests POST PATCH DELETE; profiles PUT DELETE; submissions POST PUT DELETE; topics POST PUT DELETE |
| AUTH_ONLY (1) | auth/login POST (read-only; deliberately not frozen) |
| EXTERNAL_SIDE_EFFECT | none found in `app/api` or `lib` (no outbound fetch, mail or webhook; Jitsi/YouTube are client-side links) |
| READ_ONLY | all GET handlers, except the two that purge (see layer 3) |

Coverage: middleware blocks 41/41 WRITE handlers (in-process test, 42 minus login). Proof the list is complete is mechanical:
`test-write-freeze-middleware.cjs` scans `app/api` and fails if its table differs from the handlers actually exported.
Layers 2 and 3 cover the non-mutation-method writers. Unverified: real HTTP against a deployed environment. A dev server was already
running on this checkout, so none was started. `WRITE_FREEZE` is an environment variable, so on Vercel a changed value takes effect with a new
deployment; rehearse it on a preview deployment before the window (see runbook step B).

## 4. Delta model

Baseline = frozen Phase 4 NDJSON. Final = fresh read-only export taken under freeze. Per table, keyed by primary key:

- INSERT: key absent in baseline, present in final.
- UPDATE: key in both, canonical logical hash differs. Changed column names are recorded; row content is not.
- DELETE: key in baseline, absent in final. Never inferred from counts (a test covers same-count/different-keys).
- Invariants are asserted: baseline = deleted + updated + unchanged; final = inserted + updated + unchanged; final = baseline + inserts - deletes.
- Timestamps are not used for detection. Comparison is full-row, so tables without `updated_at` and silent edits are covered.

Approved transformations are inherited from `lib/transform.cjs` unchanged (UUID->VARCHAR2(36), bool->NUMBER(1), JSON->CLOB IS JSON, timestamptz->TIMESTAMP WITH TIME ZONE,
date->DATE, time->VARCHAR2(5), NUMBER(12,4) half-away-from-zero, the four renames, chapters/topics defaults, empty string->EMPTY_CLOB).
Scale rounding on a changed or new row is a blocker unless `--allow-scale-rounding` is passed explicitly. No new transformation was added.

### Schema drift gate

The preflight fingerprint includes row counts, so it changes with any legitimate data change. The gate therefore also hashes only the structural
sections (tables, columns, constraints, indexes, absent tables). Outcomes: `EXPECTED_KNOWN_SOURCE_GAPS_IDENTICAL`,
`..._STRUCTURE_IDENTICAL_COUNTS_CHANGED` (allowed), or `NEW_SCHEMA_DRIFT` (MIGRATION_BLOCKER until reviewed). A missing preflight report is also a blocker,
because structure could not be proven. Final preflight data blockers > 0 is a blocker.

## 5. Tools and guardrails

`export-phase7-final.cjs` creates `migration-data/phase7-final-<UTC timestamp>` (refuses an existing directory), runs preflight before and after the export,
and fails the capture if structure, counts or fingerprint changed between them (proof the freeze held). It writes `phase7-identity.json`: source host/db (no secrets),
schema fingerprint, baseline manifest hash, git commit, tool versions. The export's own manifest carries the 19 table statuses, row counts, per-file SHA256 and logical checksums.
Dry run by default; execute needs `--execute --use-database-url --production-read --production-export --confirm-source-frozen`.

`compare-phase7-delta.cjs` is files-only. It verifies both snapshots, requires same source / migration manifest / order, and writes
`migration-reports/phase7-delta-manifest.json`: baseline and final snapshot identity, per-table counts, insert/update/delete IDs, baseline and final logical hashes,
changed column names, schema gate, approved transformations, warnings, blockers. No credentials, no row content.

`apply-phase7-delta.cjs`:

- Default is dry run with no database contact. `--check-target` adds Oracle SELECTs only.
- Re-derives the delta from the two snapshots and refuses a manifest that disagrees; refuses if either snapshot changed since the manifest was generated.
- Every row is classified against live Oracle by logical hash:

| Baseline / Final / Oracle | Result |
|---|---|
| absent / present / absent | PENDING_INSERT |
| present / present(changed) / equals baseline | PENDING_UPDATE |
| present / absent / equals baseline | PENDING_DELETE |
| Oracle already equals final | APPLIED (idempotent re-run, skipped) |
| anything else, including a row neither snapshot knows | `ORACLE_TARGET_DRIFT` -> STOP, nothing written |

- Execute requires all of: `--execute --confirm-target-oracle --target-schema=LMS_APP --confirm-final-delta --confirm-source-frozen`, plus
  Oracle `CURRENT_SCHEMA = LMS_APP`, target not MYLIFE, 19 canonical tables + `SCHEMA_MIGRATIONS` present with 10 migrations,
  `DB_PROVIDER` still `postgres`, a frozen `phase7-final-*` snapshot (not a preview), and no `RUNNING` ledger from a previous attempt.
- It never connects to Cockroach and never uses broad deletes, TRUNCATE, DROP or CASCADE reliance: each statement targets one exact primary key and must affect exactly 1 row.
- Order: DELETE children-first, then INSERT parents-first, then UPDATE parents-first.
- Transaction: one Oracle transaction. The dataset is tiny, there is no DDL, and no external effect, so atomicity is practical.
  Inside the transaction and before COMMIT it re-classifies every table (must be all UNCHANGED_OK/APPLIED) and checks FK orphans = 0. Any failure rolls back.
  LOB values above 30,000 bytes are refused up front (bind limit); none exist today.
- Ledger: `migration-reports/phase7-delta-ledger.json` (RUNNING -> COMPLETE or ROLLED_BACK).

Not exercised: the EXECUTE path against Oracle has not been run, by instruction. Verified instead: generated UPDATE/DELETE/INSERT SQL and placeholders
for all 19 tables (offline), dry-run and `--check-target` against the real Oracle (0 pending operations, all 41 rows UNCHANGED_OK), and refusal of
`--execute` on a preview and without confirmations. A rehearsal on a disposable Oracle schema with a synthetic delta is recommended before the window.

## 6. Freeze-window runbook (do not run yet)

A. Announce maintenance; pick a window; confirm Cockroach and Oracle baselines are still green (`validate-phase4c-import.cjs`, `db:validate:oracle`).
B. Enable the freeze: set `WRITE_FREEZE=1` in production and redeploy. Keep `DB_PROVIDER=postgres`.
C. Verify blocked: `POST/PUT/PATCH/DELETE` against a few real endpoints return 503 with `MAINTENANCE_WRITE_FREEZE`; a GET and login still work. Wait out in-flight requests (function max duration 30 s) and one cron tick.
D. `export-phase7-final.cjs --execute ...` (read-only on Cockroach).
E. The tool's stability proof (preflight before == after) confirms the freeze held. If not: STOP, discard the snapshot.
F. `compare-phase7-delta.cjs --final-dir=<phase7-final-...> --final-preflight=migration-reports/phase7-final-preflight.json` -> review `NEW_SCHEMA_DRIFT`, rounding and totals.
G. `apply-phase7-delta.cjs` dry run, then `--check-target`. Any `ORACLE_TARGET_DRIFT` is a STOP.
H. Review pending operations list against the delta manifest.
I. `apply-phase7-delta.cjs --execute --confirm-target-oracle --target-schema=LMS_APP --confirm-final-delta --confirm-source-frozen`.
J. `validate-phase4c-import.cjs --export-dir=<phase7-final-...> --phase7`. Gates below. Expected Oracle row count = the final snapshot's total, not 41.
K. Cockroach stays frozen and unmodified; production still on `postgres`.
L. GO / NO-GO for Phase 8. Unfreezing for normal operation (if NO-GO) is just unsetting `WRITE_FREEZE`.

## 7. Post-delta gates

All 19 row counts equal the final snapshot; PK parity 19/19; logical parity 19/19; field mismatches 0; FK orphans 0; duplicate groups 0; JSON, timestamps, dates,
booleans, CLOB normalization parity PASS; password hashes equal; Oracle schema validation PASS (19 tables); Phase 7 ledger COMPLETE and matches the delta manifest hash.
The Phase 4 ledger and the old 41-row expectation are not used in `--phase7` mode, and the hardcoded known-score check is skipped only if that submission no longer exists in the snapshot.

## 8. Rollback

| Failure point | Action |
|---|---|
| Before the Oracle delta (steps A-H) | Oracle untouched. Unset `WRITE_FREEZE`, redeploy. Discard the snapshot or keep it for forensics. |
| During the delta, before commit | The tool rolls back (ledger `ROLLED_BACK`). Oracle returns to its pre-run state. Investigate, then re-run. |
| After commit, validation fails | Cockroach is still the source of truth and production still points to it. Do not cut over. Re-run the apply tool: it is idempotent and reports APPLIED/PENDING. If Oracle must be reset, use targeted exact-ID recovery modeled on `cleanup-phase6-tagged.cjs` or restore from the Phase 4 baseline plus delta; no broad deletes. |
| Any time before Phase 8 | Unset `WRITE_FREEZE`; production resumes on Cockroach with no data loss. |
| Phase 8 cutover failure | Out of scope here. Because Cockroach is kept frozen and unmodified, reverting `DB_PROVIDER` to `postgres` restores service; any writes accepted on Oracle after cutover would need reverse reconciliation, which Phase 8 must plan before cutover. |

## 9. Observations

- `PUT /api/courses` 500 once in Phase 6, identical retry succeeded: `TRANSIENT_APPLICATION_RELIABILITY_OBSERVATION`. No log evidence was available; not reproduced; not a migration blocker.
- `validate-phase4c-import.cjs` without `--phase7` remains bound to the Phase 4 ledger and 41-row export.
- `npm run build` passed in this session (the Google Fonts failure from earlier phases did not recur).
- Lint: 0 errors; warnings are pre-existing unused `eslint-disable` directives in migration scripts.

## 10. Phase 7B/7C Rehearsal Results

Rehearsal date: 2026-10-08. This section records only work actually performed; it does not authorize the production freeze, final Cockroach export, LMS_APP delta, provider switch, or Phase 8.

### Phase 7B — Write Freeze

- **Result: BLOCKED (real HTTP freeze).** An already-running local Next development server on port 5001 answered `GET /api/health` with 200 and `POST /api/courses` with 401 (not the freeze response), establishing that its current process was unfrozen. Its health response identified its local provider as `oracle`; no conclusion about the production provider was drawn from that local process.
- A separate local server with `WRITE_FREEZE=1` could not be started because Next detected the existing development-server lock for this checkout. The existing process was deliberately not stopped or reconfigured. Therefore the required real-HTTP frozen reads, all 41 frozen mutation responses, authenticated login, and cron invocation were not claimed as passed.
- Unauthenticated representative GETs reached their normal authorization behavior: `/api/data`, `/api/levels`, `/api/profiles`, `/api/live-classes`, and `/api/private-lesson-requests` returned 401 rather than a maintenance response. Credentials for a safe rehearsal user were not available, so authenticated reads were not attempted.
- Offline freeze proof passed: `test-write-freeze.cjs` 8/8, and `test-write-freeze-middleware.cjs` verified the complete route inventory — 41/41 write handlers return 503 under freeze, all 41 are unblocked with freeze off, GET/login remain available, and the maintenance response is the non-sensitive `MAINTENANCE_WRITE_FREEZE` body. The SQL classifier rejects INSERT, UPDATE, DELETE, MERGE, DDL, locks, `SELECT … FOR UPDATE`, and data-modifying CTEs; source inspection confirms both adapters call this classifier before execution. An independent adapter-execution probe was not run, so that sub-check remains blocked rather than marked PASS.
- Hidden writer design review passed: `purgeExpiredPrivateLessonRequests()` returns 0 before issuing SQL while frozen, covering both `GET /api/private-lesson-requests` and the ten-minute cron route. It was not invoked over frozen HTTP because the required process could not be launched.
- Freeze was not enabled in any production environment. The existing local process was left unchanged.

### Phase 7C — Scratch Oracle Delta

- **Result: BLOCKED_SCRATCH_SCHEMA.** The configured Oracle connection is not accompanied by a separately provisioned disposable account/schema, and no DBA authorization to create `LMS_PHASE7_REHEARSAL` was available. Per the safety rule, no schema was created, inspected for DDL privileges, or substituted with `LMS_APP`/`MYLIFE_APP`.
- Consequently no synthetic snapshots, dry run, execute, reconciliation, idempotency, drift, rollback, FK-delete-order, numeric, CLOB, or JSON Oracle execution test was performed. `apply-phase7-delta.cjs` retains its production-only execute guard (`--target-schema=LMS_APP` and matching Oracle schema); it was not weakened.
- Offline delta logic passed 10/10 in `test-phase7-delta.cjs`, including INSERT/UPDATE/DELETE detection, idempotent classification, target-drift stop classification, and child-before-parent deletion order.

### Static checks

- `npm run lint`: PASS with 0 errors and 15 existing warnings.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS after the environment was permitted to retrieve the configured Google Fonts. The initial sandbox-only build attempt failed only on those font fetches.

Production safeguards remain unchanged: production `WRITE_FREEZE` was not enabled, no Cockroach writes were issued, no LMS_APP business-data writes were issued, no provider switch occurred, and Phase 8 was not started. Phase 7 production execution readiness is **NOT READY** until both a dedicated frozen local/preview HTTP deployment and an explicitly authorized disposable Oracle schema have completed the required rehearsal matrix.

## 11. Rehearsal continuation (2026-10-09)

### 7B isolated frozen HTTP server

- **Isolation PASS:** an isolated Git worktree was created from committed HEAD and served on port 5002. The existing port-5001 server was neither stopped nor reconfigured. A shared dependency junction was rejected by Turbopack, so the isolated server was restarted with `next dev --webpack -p 5002`; this is a worktree-only startup change, not a production change.
- **Real HTTP mutation freeze PASS:** all 41 audited mutation handlers returned HTTP 503 with `code=MAINTENANCE_WRITE_FREEZE` over `http://localhost:5002`. No 401 or 403 result was counted as a pass.
- **Login endpoint reached, but normal-login workflow BLOCKED_CREDENTIALS:** `POST /api/auth/login` with an intentionally incomplete body returned validation HTTP 400 rather than freeze 503. No reusable Phase 6 password, token, or browser session was available, so an authenticated login was not attempted.
- **Health and authenticated reads BLOCKED_ORACLE_CONNECTIVITY:** the isolated Oracle-backed process returned health HTTP 503 (`Database connection failed`; underlying queue timeout). An unauthenticated private-request read returned its normal 401. No authenticated read, hidden-purge HTTP proof, or authorized cron invocation was claimed.
- **Adapter backstops PASS:** isolated fake-driver probes prove both adapters allow SELECT, SHOW and read-only WITH while intercepting INSERT, UPDATE, DELETE, MERGE, DDL and SELECT FOR UPDATE before driver execution. Existing freeze, route-inventory and delta tests also passed.

### 7C scratch Oracle schema

> Superseded by section 12. At the time of this subsection no scratch schema existed; it was provisioned afterwards by the Oracle administrator and the 7C rehearsal is recorded in section 12.

No authorized Oracle administrator session or existing `LMS_PHASE7_REHEARSAL` credentials were available. No schema creation, migration, import, delta execution, or query was attempted against `LMS_APP`, `MYLIFE_APP`, Cockroach, or any other production target.

The canonical migrations create 19 LMS business tables plus `SCHEMA_MIGRATIONS`; they contain table constraints and 27 indexes, but no sequences, triggers, views, packages, or cross-schema references. The minimum dedicated-user privileges are therefore `CREATE SESSION`, `CREATE TABLE`, and `CREATE INDEX`, plus a bounded quota in its own default tablespace. An Oracle Autonomous Database administrator may provision the disposable schema with:

```sql
CREATE USER LMS_PHASE7_REHEARSAL
  IDENTIFIED BY "<CHOOSE_STRONG_PASSWORD_LOCALLY>";

GRANT CREATE SESSION TO LMS_PHASE7_REHEARSAL;
GRANT CREATE TABLE TO LMS_PHASE7_REHEARSAL;
GRANT CREATE INDEX TO LMS_PHASE7_REHEARSAL;
ALTER USER LMS_PHASE7_REHEARSAL QUOTA 1G ON DATA;
```

`DATA` is the expected Autonomous Database user tablespace; the administrator must substitute the account's approved user tablespace if it differs. Do not grant DBA, `CREATE ANY ...`, or privileges on `LMS_APP` / `MYLIFE_APP`.

`apply-phase7-delta.cjs` now keeps production execution limited to `LMS_APP` with its existing confirmations, and adds a separate rehearsal execution path requiring all of `--execute --rehearsal --target-schema=LMS_PHASE7_REHEARSAL --confirm-rehearsal-target` and an Oracle current-schema match. `MYLIFE_APP` remains refused. No rehearsal execution was run because the scratch schema does not exist.

## 12. Phase 7C scratch rehearsal results (2026-10-09)

Target: dedicated schema `LMS_PHASE7_REHEARSAL` (credentials only from `PHASE7_REHEARSAL_ORACLE_*`, loaded by the rehearsal-only preload `scripts/migration/lib/rehearsal-env.cjs`, which also pins `DB_PROVIDER=postgres`). Every rehearsal helper refuses unless both `USER` and `CURRENT_SCHEMA` equal `LMS_PHASE7_REHEARSAL`. Nothing was run against `LMS_APP`, `MYLIFE_APP` or Cockroach. The data is synthetic (15-row baseline, 13-row final, delta +1 ~3 -3, 9 unchanged); no production rows were used.

**Result: Phase 7C COMPLETE.** This does not authorize the production freeze, final export, `LMS_APP` delta, provider switch or Phase 8.

### Tooling added (rehearsal-only, no secrets)

| Script | Purpose |
|---|---|
| `reconcile-phase7-rehearsal.cjs` | Read-only reconciliation of the scratch schema against a snapshot. Does not use `apply-phase7-delta.cjs` or `lib/delta.cjs`. |
| `reset-phase7-rehearsal.cjs` | Resets scratch business rows to a rehearsal snapshot or to empty, using row-level DELETE and INSERT only. |
| `rehearsal-guard-matrix.cjs` | 22 wrong-target and flag-misuse cases. |
| `rehearsal-target-drift.cjs` | Target-drift test. |
| `rehearsal-rollback.cjs` | Controlled rollback test. |
| `rehearsal-negative-rounding.cjs` | Negative `NUMBER(12,4)` rounding test. |
| `lib/rehearsal-state.cjs` | Raw scratch-state hash used as zero-write evidence. |

### Hardening of `apply-phase7-delta.cjs` found by the matrix

- `--confirm-rehearsal-target` is refused in production mode.
- Production confirmations are refused together with `--rehearsal`.
- `--rehearsal-fail-after-operation` with no value is refused explicitly.

### Fixture defect found and fixed

The first independent run of `validate-phase4c-import.cjs --phase7` against the scratch schema reported logical parity 8/19. The cause was in the synthetic fixture, not the apply path. The fixture wrote a placeholder `logical_sha256` (a hash of the file text) instead of the exporter's aggregate of per-row transformed values, and the chapter/topic rows did not carry the synthesized `is_published=1`/`is_locked=0` defaults. The fixture builder now computes the exporter-style logical hash and sets those defaults. The apply script's own checks and the independent reconciler had agreed throughout; only the checksum-file comparison differed. All destructive tests below were re-run after the fix.

### Results

| Check | Result |
|---|---|
| Guard matrix (22 cases: production mode + scratch user, missing confirmations, wrong `--target-schema`, wrong `CURRENT_SCHEMA`, fault injection without `--rehearsal` / N=0 / negative / non-numeric / fractional / empty / valueless, missing `--execute`, rehearsal-only flag in production mode, mixed confirmations) | PASS, 0 failures. Raw state hash and ledger unchanged after every case. |
| Independent reconciliation after delta | PASS: 13 rows, PK 19/19, logical 19/19, field mismatches 0, FK orphans 0, duplicate groups 0. JSON, timestamps, dates, booleans, CLOB, numeric, Thai Unicode (16 fields, byte-compared) all 0 mismatches. A negative control (baseline state compared with the final snapshot) correctly failed. |
| Target drift | PASS. `courses.title` altered after baseline reset. Both `--check-target` and `--execute` stopped with `ORACLE_TARGET_DRIFT` (exit 2), 0 writes, altered value intact, ledger unchanged. |
| Controlled rollback | PASS for fail-after-operation 1, 4, 6 and 7 (of 7 operations). Each: controlled failure, ledger `ROLLED_BACK` with N operations executed, raw Oracle state hash equal to baseline, independent reconcile of baseline PASS. |
| Negative rounding `-1.23455` | PASS. Compare without approval: `SCALE_ROUNDING_NOT_AUTHORIZED`; apply refused the blocked delta with 0 writes. With `--allow-scale-rounding`: committed, Oracle read-back `-1.2346`. Column `quiz_questions.points`, because `assignments.points` and `submissions.score` carry `> 0` / `>= 0` checks. |
| Final clean delta | PASS: 7 operations committed, independent reconciliation PASS, `validate-phase4c-import.cjs --phase7` PASS (19/19 counts, PK and logical; passwords 2/2). |
| Idempotency | PASS: re-run reports 0 pending operations, `NOTHING TO DO`, reconciliation still PASS. |
| Scratch cleanup | PASS: business rows 0, `SCHEMA_MIGRATIONS` rows 10, FK orphans 0, duplicate groups 0. 20 tables, 70 indexes and all constraints (P 20, R 31, U 7, C 183) unchanged and ENABLED. Method: row-level DELETE children-first. No DROP, TRUNCATE or DDL. |

Reports in `migration-reports/` (git-ignored, no secrets): `phase7-rehearsal.json`, `-guard-matrix.json`, `-target-drift.json`, `-rollback.json`, `-negative-rounding.json`, `-reconciliation.json`, `-cleanup-reconciliation.json`, `-validate.json`.

### Static checks and tests

- `npm run lint`: 0 errors, 15 warnings (pre-existing unused `eslint-disable` directives in migration scripts).
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS (no Google Fonts failure this time).
- `test-phase7-delta.cjs` 10/10, `test-write-freeze.cjs` 8/8 (needs `node --experimental-strip-types`), `test-write-freeze-middleware.cjs` 41/41 handlers, `test-write-freeze-adapters.cjs` Postgres and Oracle PASS, `selftest.cjs` 17/17.

### What this does not prove

Phase 7B items still open: Oracle health over HTTP, authenticated login, authenticated reads, hidden GET purge over HTTP and the cron purge (see section 11 for the causes). The rehearsal exercised synthetic data in a scratch schema, so production data volume and real LOB sizes remain untested. Production execution readiness stays **NOT READY**.

## 13. Phase 7B completion (2026-10-09)

Supersedes the BLOCKED items in sections 10 and 11. Target was `LMS_PHASE7_REHEARSAL` only. No production setting, `LMS_APP`, `MYLIFE_APP` or Cockroach was touched.

### Oracle connectivity on port 5002

- **Standalone probe PASS.** A SELECT-only `node-oracledb` probe (thin mode, 7.0.1) with the scratch credentials and the app's pool options returned `USER = CURRENT_SCHEMA = LMS_PHASE7_REHEARSAL` for both a single connection (736 ms) and a pooled connection (485 ms).
- **Next.js PASS.** `GET /api/health` returned 200 with `provider: oracle` under both `next start -p 5002` and `next dev --webpack -p 5002`.
- **Variables compared** (names and presence only, no values): all `ORACLE_*` variables, pool and timeout settings, the wallet path (absolute, directory present with `tnsnames.ora`, `sqlnet.ora`, `cwallet.sso`), and `TNS_ADMIN` (unset in both paths, not needed because `configDir` is passed explicitly). Pool options in `lib/database/oracle.ts` match the probe.
- **Finding: a plain `.env.local` load maps `ORACLE_*` to `LMS_APP`.** The scratch account lives under `PHASE7_REHEARSAL_ORACLE_*`. A server that is simply started from this checkout would connect as `LMS_APP`. The rehearsal launcher `scripts/migration/rehearsal-phase7b-server.cjs` therefore remaps the variables through `lib/rehearsal-env.cjs`, points `DATABASE_URL` at an unreachable address so Cockroach cannot be contacted, and sets `WRITE_FREEZE=1` and `DB_PROVIDER=oracle` for that child process only.
- **Root cause of the earlier 503: not reproduced.** The earlier isolated worktree no longer exists, so its exact failure could not be replayed. The most likely explanation is that it did not receive the Oracle credentials and wallet environment (a worktree has no `.env.local`), so pool requests waited until `queueTimeout`. This is unconfirmed. No production Oracle setting was changed.

### Results (real HTTP, `WRITE_FREEZE=1`)

| Check | Result |
|---|---|
| Health | PASS, 200, provider `oracle` |
| Login (rehearsal teacher, normal bcrypt flow) | PASS, 200 with token, not the freeze 503. Wrong password returns 401. |
| Authenticated reads: `/api/data`, `/api/levels`, `/api/profiles`, `/api/live-classes`, `/api/private-lesson-requests` | PASS, all 200. Unauthenticated read returns 401. |
| Mutation freeze | PASS: 41/41 from section 11, plus a `POST /api/courses` with a valid token returns 503 `MAINTENANCE_WRITE_FREEZE` |
| Hidden GET purge | PASS: one expired accepted private lesson request; 3 authenticated `GET /api/private-lesson-requests` returned 200; row count and raw scratch state hash identical before and after (DELETE writes 0) |
| Purge control | With `WRITE_FREEZE=0` (scratch only) the same GET deleted the expired row, so the fixture row was genuinely purgeable |
| Cron purge | PASS: no auth 401, wrong secret 401, correct local-only `CRON_SECRET` 200 `{"deletedCount":0}`; row count and state hash unchanged |

The rehearsal password, JWT secret and `CRON_SECRET` were random, held in the environment only, and deleted afterwards. Authenticated response bodies were not logged.

### Cleanup

Scratch returned to business rows 0, `SCHEMA_MIGRATIONS` 10, FK orphans 0, duplicate groups 0; 20 tables, 70 indexes and all constraints still ENABLED. The server on port 5002 was stopped and temporary secret files removed.

One tooling fix came out of cleanup: the Autonomous `high` service intermittently failed row-level deletes with `ORA-12860` (sibling row lock deadlock from auto-parallel DML) after the HTTP run. `lib/rehearsal-state.cjs` now issues `ALTER SESSION DISABLE PARALLEL DML` on its own session. This is session-level, rehearsal-only and has no schema effect.

### Overall

All Phase 7B and 7C rehearsal items now PASS. Static checks after the last change: lint 0 errors (15 warnings, pre-existing directives), `tsc` PASS, `npm run build` PASS, `test-phase7-delta` 10/10, `test-write-freeze` 8/8, middleware 41 handlers, adapters PASS, `selftest` 17/17.

Overall Phase 7 rehearsal: **COMPLETE**. Production execution readiness: **READY**, meaning the rehearsal gates are satisfied. It authorizes nothing: the production freeze, final export, `LMS_APP` delta, provider switch and Phase 8 each still need explicit approval.

Not proven by this rehearsal: the freeze behavior on a real Vercel deployment (`WRITE_FREEZE` is an environment variable and needs a redeploy, see runbook step B), production data volume, and LOB sizes above the 30,000-byte bind limit (the apply tool refuses those up front).
