# Phase 2 — Oracle Canonical Schema

## 1. Summary

Phase 2 translates the 19-table active LMS schema from `lib/db.ts` into forward-only, versioned Oracle migrations. It creates no data-transfer code, runs no DDL without Oracle credentials, does not change `DB_PROVIDER`, and does not migrate application routes.

## 2. Migration files created

| Migration | Tables / purpose |
|---|---|
| `001_users.sql` | users |
| `002_course_levels_and_courses.sql` | course levels and courses |
| `003_course_content.sql` | chapters, topics, lessons, lesson segments |
| `004_learning.sql` | enrollments, announcements, assignments |
| `005_quiz_and_submissions.sql` | quiz questions and submissions |
| `006_support_and_progress.sql` | meetings, teacher availability, lesson completion |
| `007_live_classes.sql` | live classes and participants |
| `008_private_lessons.sql` | private lesson requests after live classes |
| `009_broadcasts.sql` | lesson live broadcasts |
| `010_indexes.sql` | 28 reviewed indexes |

Each migration uses the Phase 1 runner's explicit `-- @statement` delimiter. This gives node-oracledb one Oracle statement at a time without brittle semicolon splitting. Migrations are immutable after application.

## 3. 19-table inventory and mappings

All tables are represented in `database/oracle/schema-manifest.json`: users, courses, course levels, enrollments, announcements, chapters, topics, lessons, lesson segments, assignments, quiz questions, submissions, meetings, private requests, availability, lesson completions, live classes, participants, and broadcasts.

The canonical type policies are `VARCHAR2(36)` UUIDs, checked `NUMBER(1)` booleans, `TIMESTAMP WITH TIME ZONE` instants, `DATE` due dates, `VARCHAR2(5)` weekly time-only fields, `NUMBER(10,0)` integral fields, and `NUMBER(12,4)` score/point fields. Long content and JSON use CLOB.

## 4. Constraints and foreign keys

The migration set declares 19 primary keys, 31 foreign keys, 7 non-PK unique constraints, and 41 named business/JSON/boolean checks. Constraint names follow the documented `pk_`, `fk_`, `uq_`, and `ck_` convention, with abbreviated child names where necessary for Oracle's identifier limits.

Oracle supports the required explicit `ON DELETE CASCADE` and `ON DELETE SET NULL` actions. PostgreSQL's `ON DELETE RESTRICT` is represented by omitting an action: Oracle's default no-action behavior prevents deletion of a referenced parent, preserving the active schema intent.

Private requests are created after `live_classes`, eliminating the `live_class_id` dependency concern without a later `ALTER TABLE`.

## 5. Oracle-specific design changes

`type`, `level`, and `value` were treated as risky generic Oracle identifiers and are mapped without quoted identifiers:

| PostgreSQL source | Oracle target |
|---|---|
| `courses.level` | `courses.course_level` |
| `course_levels.value` | `course_levels.level_value` |
| `assignments.type` | `assignments.assignment_type` |
| `submissions.type` | `submissions.submission_type` |

Later route/data migration work must use this documented mapping. No other table or column needs quoted case-sensitive naming.

## 6. Index strategy

The 28 indexes cover foreign-key lookups, dashboard/course hierarchy joins, common sort orders, submission filters, private-request scheduling filters, and live-class access. Unique constraints already provide their own indexes, so redundant copies were avoided.

The PostgreSQL partial broadcast index was intentionally not translated. The primary access path is by `lesson_id` (the primary key), and the table is expected to be small; no `is_live`-only index is warranted before Oracle workload plans exist.

## 7. JSON and time-only strategy

The six JSON fields are CLOB columns with `IS JSON` checks. Oracle documentation supports `IS JSON` check constraints on CLOB data, including Oracle 19c; target Autonomous version/capability is still a live-environment validation item. JSON semantic validation remains application/data-migration work.

Availability stores zero-padded `HH24:MI` in `VARCHAR2(5)`. Regex checks enforce format and `start_time < end_time` is lexicographically correct for that fixed-width format. It avoids incorrectly using Oracle `DATE` for standalone time-of-day.

## 8. Data-migration compatibility

[DATA_MIGRATION_COMPATIBILITY.md](DATA_MIGRATION_COMPATIBILITY.md) maps every table, identifies transformations and validation rules, and highlights UUID/text/JSON/timezone/numeric/null risks. The major unresolved source-data concern is Oracle's empty-string-is-NULL behavior; it requires a reviewed Phase 4 import policy, not silent conversion.

## 9. Validation approach and tests

`scripts/validate-oracle-schema.cjs` is read-only. It compares the manifest to `USER_TABLES`, `USER_TAB_COLUMNS`, `USER_CONSTRAINTS`, and `USER_INDEXES`, including columns, nullability, type families, named constraints, and intentional indexes.

Run after applying to an empty non-production Oracle schema:

```bash
npm run db:test:oracle
npm run db:migrate:oracle
npm run db:validate:oracle
```

Static migration checks passed: the manifest contains 19 tables, migrations contain 19 `CREATE TABLE` statements and 47 explicit statement markers, all manifest columns/constraints/indexes cross-reference to DDL, manifest JSON parses, and no prohibited PostgreSQL DDL construct was found. `npm run lint` passed with 10 existing warnings and no errors; `npx tsc --noEmit` passed. The intentional validation-script smoke test failed clearly at missing `ORACLE_USER`, before attempting a connection.

Live connection, DDL execution, and dictionary validation are not run when credentials are unavailable.

## 10. Known limitations and Phase 3 readiness

- No Oracle connection credentials were supplied, so no DDL syntax was validated by an Oracle server.
- The migration runner is forward-only; no destructive reset/rollback script exists.
- Existing PostgreSQL routes still use their current column names and SQL; the four renamed Oracle columns are only for later deliberate route translation.
- Empty strings need an explicit data-import/route policy.

Phase 3 can use this schema as the target contract, but must not start data migration or route cutover without successful non-production migration and schema-validation evidence.

## Phase 2 Completion Checklist

- [x] all 19 tables translated
- [x] UUIDs use VARCHAR2(36)
- [x] booleans use NUMBER(1)
- [x] JSON policy applied
- [x] timestamps use TIMESTAMP WITH TIME ZONE
- [x] date-only fields mapped correctly
- [x] time-only fields mapped correctly
- [x] numeric precision reviewed
- [x] PK constraints preserved
- [x] FK constraints preserved
- [x] unique constraints preserved
- [x] check constraints preserved
- [x] indexes reviewed
- [x] partial index redesigned intentionally
- [x] migrations are versioned and immutable
- [x] no PostgreSQL-only DDL remains
- [x] schema manifest created
- [x] data migration compatibility report created
- [x] schema validation script created
- [x] production data was NOT migrated
- [x] DB_PROVIDER was NOT switched
