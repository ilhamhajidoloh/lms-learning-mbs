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
