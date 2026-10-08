# Phase 5: Full Oracle Validation

**Status: BLOCKED (environment connectivity).** No production cutover, source delta, data deletion, or fixture write was performed.

## Baseline

| Item | Value |
|---|---|
| Snapshot | `migration-data/phase4-production-20261007T180359Z` |
| Manifest SHA-256 | `b18226a10f3cc795966853661cec9eafb4ac42d5face04545a8bf73d431b6868` |
| Frozen baseline rows | 41 across 19 tables |
| Last successful Phase 4C validation | 2026-10-07T18:26:49.453Z |
| Phase 4C result at that time | PASS: 19/19 row counts, PK equality, and logical checksums; 0 field mismatches |

## This validation attempt

The mandatory new pre-test Phase 4C read-only validation was started with the frozen production export. It could not obtain an Oracle connection and wrote no report. The independent Oracle connectivity smoke test failed with `NJS-040` after its 60-second queue timeout. This environment therefore cannot prove that the baseline is unchanged and Phase 5 stops before application boot or any database-writing test.

No Phase 3 suites were run. Inspection confirmed that the existing Phase 3H, 3IJ, and 3KL suites seed tagged data and issue writes, so they must not be used until the Oracle baseline gate passes and their cleanup is re-reviewed in the live target context.

## Results matrix

| Domain | Read | Write | Auth | Cleanup |
|---|---|---|---|---|
| Health | NOT RUN | N/A | N/A | N/A |
| Public catalog | NOT RUN | N/A | N/A | N/A |
| Auth/users | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Course hierarchy | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Enrollment | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Announcements | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Assignments/quiz | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Submissions/scoring | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Progress | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Private lessons | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Live classes | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Live broadcast | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

## Non-database checks

| Check | Result | Notes |
|---|---|---|
| `npm run lint` | PASS | Completed successfully |
| `npx tsc --noEmit` | PASS | Completed successfully |
| `npm run build` | FAIL (environment) | Compilation reached the font-fetch phase, but this environment could not fetch Inter and Kanit from Google Fonts. No DB operation was invoked. |
| Production source drift inventory | NOT RUN | The read-only Cockroach preflight failed before producing counts. See `migration-reports/phase5-source-drift.json`. |
| Oracle schema validation | NOT RUN | Blocked by the same Oracle connectivity failure. |

## Required resume sequence

1. Restore outbound connectivity and wallet/service access to Oracle, then run `node scripts/migration/validate-phase4c-import.cjs --export-dir=migration-data/phase4-production-20261007T180359Z`.
2. Proceed only if it reports 41 rows, 19/19 logical checksums, and zero mismatches.
3. Boot a local process with `DB_PROVIDER=oracle`; execute read/auth tests before fixture-tagged write tests.
4. After cleanup, rerun the Phase 4C validator and `npm run db:validate:oracle`.

## Phase 6 readiness

**NOT READY.** Phase 5 has not validated the Oracle application path. Production remains on `DB_PROVIDER=postgres`; no source delta was applied and the Phase 4B export is retained.

## Phase 5A: Environment connectivity recovery (2026-10-08)

**Status: BLOCKED.** This was a read-only diagnostic session. Oracle and Cockroach received zero writes.

| Check | Result | Evidence |
|---|---|---|
| Oracle effective configuration | PASS | `LMS_APP`; direct TCPS service descriptor; pool `0/4/1`; queue timeout 10,000 ms; pool timeout 60 s; connect timeout 15 s |
| Oracle wallet/TLS configuration | PASS | Wallet directory exists and contains the expected wallet, trust-store, `sqlnet.ora`, and `tnsnames.ora` files. Its host/service match the configured descriptor. |
| Oracle DNS | PASS | The Autonomous DB hostname resolves. |
| Oracle TCP reachability | FAIL | TCP to the resolved Oracle address on port 1522 is unreachable. |
| Direct Oracle connection | FAIL | Existing one-connection test ended with `NJS-040` after its 60-second queue timeout. |
| Pool exhaustion/stale Node processes | Not indicated | No Node/Next process was present. The application pool is process-global and connections are released in `finally`; there was no basis to raise pool capacity. |
| Cockroach DNS | PASS | The production hostname resolves to its load-balancer addresses. |
| Cockroach TCP reachability | FAIL | TCP to port 26257 is unreachable for every resolved address. |
| Cockroach read-only preflight | FAIL | It stopped before its first read because transport connectivity was unavailable. |

### Root cause

The common failure is **outbound network egress/firewall reachability** from this execution environment to the managed database ports. It is not a data, Oracle schema, wallet/service-name, application-pool, or password diagnosis. No local configuration change was applied because the configuration is internally consistent and changing it would not address failed TCP reachability.

The Oracle Phase 4C validator and schema validator remain **NOT RUN** for this recovery attempt, because the direct connection gate failed. The Phase 4C ledger remains the already-recorded complete 41-row run for manifest `b18226a10f3cc795966853661cec9eafb4ac42d5face04545a8bf73d431b6868`; it was read only and not changed.

The build remains **BLOCKED BY FONT FETCH**, separately from database connectivity. Lint and TypeScript remain PASS from the prior Phase 5 attempt.

### Resume gate

Allow outbound TCP from this environment to Oracle TCPS port 1522 and CockroachDB port 26257 (and any required enterprise proxy/VPN route). Then rerun the direct Oracle test, Phase 4C validator, Oracle schema validator, and the Cockroach `--production-read` preflight. Do not resume application/fixture tests until all gates pass.

## Phase 5 resume attempt (2026-10-08)

**Status: BLOCKED before application validation.** The requested resume was not started because the mandatory live gates did not pass in this execution environment:

| Gate | Result |
|---|---|
| Oracle TCP, port 1522 | FAIL |
| Oracle Phase 4C baseline recheck | NOT RUN — transport gate failed; no report was written |
| Oracle schema check | NOT RUN — transport gate failed |
| Cockroach TCP, port 26257 | FAIL |
| Cockroach read-only preflight | FAIL before first read |

The test fixtures list is empty and cleanup is not applicable. No Oracle/Cockroach write occurred, `DB_PROVIDER` was not changed, no production delta was applied, and no application server was started. The supplied prior successful-gate status must be re-established from this machine before Phase 5 can continue.
