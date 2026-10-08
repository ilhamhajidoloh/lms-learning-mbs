# Oracle migrations

Run Oracle migrations deliberately, never as part of `next build`:

```bash
npm run db:migrate:oracle
```

The runner creates `schema_migrations` once after checking Oracle's `USER_TABLES` dictionary, then applies each `migrations/<version>_<name>.sql` file exactly once and records a SHA-256 checksum. Migration files are ordered lexically, must contain one Oracle statement (without a trailing SQL*Plus `/` delimiter), and must be immutable after application.

Phase 1 intentionally includes no LMS-table migration. `lib/db.ts` is the canonical input for the later, reviewed Oracle schema translation; it must not be copied verbatim.

The runner needs `ORACLE_USER`, `ORACLE_PASSWORD`, and `ORACLE_CONNECT_STRING`, with wallet settings when the Autonomous Database connection method needs them. It never runs during a Next.js build.

Each executable statement in a migration is preceded by a line containing `-- @statement`. This is an intentional delimiter: node-oracledb executes a single SQL statement at a time, and the marker avoids unsafe generic semicolon splitting.
