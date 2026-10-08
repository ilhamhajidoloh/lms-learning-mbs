# Phase 1 — Oracle Database Foundation

## 1. Summary

Phase 1 adds an opt-in Oracle foundation while preserving the existing PostgreSQL/CockroachDB application path. No LMS business route was translated except the non-destructive health proof of concept, and no Oracle LMS schema/data migration was executed.

## 2. Files changed

- `package.json`, `package-lock.json`: add `oracledb` 7.0.1 and explicit database scripts; `build` is now `next build`.
- `.gitignore`, `.env.example`: Oracle environment variable names and wallet/credential protections.
- `lib/database/*`: provider config, normalized results, PostgreSQL/Oracle adapters, transactions, JSON/boolean helpers, and normalized errors.
- `app/api/health/route.ts`: provider-selected proof of concept, pinned to Node.js runtime.
- `database/oracle/*`: versioned migration runner architecture and operational README.
- `scripts/test-oracle-connection.cjs`: deliberate, non-destructive Oracle health test.
- `ORACLE_SCHEMA_DECISIONS.md`: canonical schema and storage decisions.

## 3. New database architecture

```text
route / script
  -> lib/database/index.ts (provider selection)
     -> postgres.ts -> existing lib/db.ts Pool
     -> oracle.ts   -> singleton node-oracledb Thin-mode pool
```

The exported `query()` returns `DbResult<T>` with `rows` and `rowCount`. `withTransaction()` obtains one provider connection, commits once on callback success, rolls back on failure, and releases in `finally`.

## 4. `DB_PROVIDER` behavior

`DB_PROVIDER` supports `postgres` and `oracle`. Missing or `postgres` preserves the legacy PostgreSQL/CockroachDB default. Any other value produces a configuration error. Oracle credentials are loaded only when Oracle is selected or an Oracle CLI script is explicitly run.

## 5. PostgreSQL adapter

`lib/database/postgres.ts` wraps the existing `lib/db.ts` singleton rather than creating a second pool. It preserves positional binds and normalizes `pg` results. Existing routes still import and use `lib/db.ts` directly; that behavior was deliberately not changed.

## 6. Oracle adapter and pool lifecycle

`lib/database/oracle.ts` uses node-oracledb Thin mode by default (no Thick-client initialization). It lazily creates one hot-reload-safe global pool promise and configures object result rows. Oracle connections are acquired only for work and closed after standalone queries; the pool remains reusable. `closeOraclePool()` exists for controlled CLI shutdown.

Oracle configuration accepts `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING`, optional wallet location/password, and bounded pool/timeouts. Configuration failures do not log environment values.

## 7. Transaction design

Transactions always acquire a dedicated connection. PostgreSQL issues `BEGIN` on that client; Oracle uses its connection's transaction and explicit commit/rollback. The unsafe pool-level broadcast transaction discovered in Phase 0 is documented but intentionally not rewritten in this phase.

## 8. Result normalization

Both adapters return `{ rows, rowCount }`. Oracle uses `OUT_FORMAT_OBJECT`; DML uses `rowsAffected`, while selects use row length. Column casing and application row mapping remain deliberate route-migration work, not implicit magic.

## 9. UUID, boolean, JSON, date/time, and numeric decisions

See [ORACLE_SCHEMA_DECISIONS.md](ORACLE_SCHEMA_DECISIONS.md). In brief: UUID is `VARCHAR2(36)` generated in application code; booleans are checked `NUMBER(1)` mapped centrally; JSON uses an explicit serializer/parser and future JSON-capable column/CLOB decision; instants map to `TIMESTAMP WITH TIME ZONE`; date-only stays `DATE`; time-only has an explicit non-`DATE` design; integers use `NUMBER(10,0)` and scores `NUMBER(12,4)` pending domain confirmation.

Assignment due-date business timezone remains unresolved and must be decided before deadline/scoring routes move.

## 10. Migration architecture and deployment changes

`schema_migrations` has version, name, applied time, and checksum. The runner uses `USER_TABLES` to bootstrap that ledger once, then applies immutable lexical migrations once. It does not use `CREATE TABLE IF NOT EXISTS` as migration strategy.

Commands:

```bash
npm run db:migrate:postgres  # existing manual Cockroach/PostgreSQL migration
npm run db:migrate:oracle    # explicit Oracle ledger/future migrations
npm run db:test:oracle       # non-destructive SELECT from DUAL
npm run build                # Next.js build only; no DDL
```

## 11. Health test and security

The health route runs `SELECT 1 AS value` for PostgreSQL or `SELECT 1 AS value FROM DUAL` for Oracle through the abstraction. The Oracle CLI additionally reads `SYSTIMESTAMP`, closes connection/pool, and exits non-zero on failure without printing credentials or wallet settings.

Wallet files/directories, keystores, `tnsnames.ora`, and environment files are ignored. No secret or wallet content is present in this change.

## 12. Tests performed

- `npm run lint`: passed with 10 pre-existing warnings and no errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: confirmed it runs `next build` without a database migration. It was blocked after compilation by unavailable Google Fonts (`Inter` and `Kanit`) from `fonts.googleapis.com`, an existing network-dependent build input.
- PostgreSQL runtime connectivity: not exercised because no database URL was supplied; the adapter preserves the existing pool.
- Oracle connectivity: intentionally invoked; it failed clearly before connection because `ORACLE_USER` was not configured. No credential/wallet was available for a live test.

## 13. Known limitations

- No 251 legacy query calls were rewritten.
- No Oracle LMS table or data migration was run.
- The runner executes one statement per migration file; complex PL/SQL migrations need an intentional future runner extension.
- The Oracle driver is loaded dynamically because node-oracledb 7.0.1's installed package has no TypeScript declaration file; the adapter narrows the used API locally.
- The repository's current Git ownership configuration prevents a normal `git diff` check in this execution environment; source-level checks are still run.

## 14. Phase 2 readiness

Phase 2 can begin route-by-route SQL translation only after review of the canonical schema decisions, migration-deployment ownership, and test fixtures for JSON/scoring/date behavior.

## Phase 1 Completion Checklist

- [x] node-oracledb installed
- [x] pg retained
- [x] DB_PROVIDER introduced
- [x] Oracle configuration isolated
- [x] Oracle pool implemented
- [x] PostgreSQL adapter available
- [x] Oracle adapter available
- [x] normalized DB result type implemented
- [x] dedicated-connection transaction helper implemented
- [x] JSON boundary implemented
- [x] boolean boundary implemented
- [x] UUID policy documented
- [x] date/time policy documented
- [x] number policy documented
- [x] versioned Oracle migration structure created
- [x] migration execution removed from Next.js build
- [x] explicit migration commands available
- [x] Oracle connectivity test created
- [x] no secrets committed
- [x] existing PostgreSQL mode preserved
- [x] lint checks pass (warnings only)
- [ ] build checks pass — blocked by Google Fonts network fetch, unrelated to the database foundation
