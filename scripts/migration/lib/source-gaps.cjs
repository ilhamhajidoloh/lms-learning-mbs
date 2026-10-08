// Phase 4A: explicit policy for source schemas that are OLDER than the canonical (Oracle) schema.
// Nothing here invents data: an absent table contributes 0 rows, an absent column takes the canonical default.
//
// Evidence (verified in this repository):
//  - lib/db.ts migrateDatabase(): `ALTER TABLE chapters|topics ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE`
//    and `... is_locked BOOLEAN NOT NULL DEFAULT FALSE`  (the same defaults the source database applies to its own old rows).
//  - database/oracle/migrations/003_course_content.sql: chapters/topics `is_published NUMBER(1) DEFAULT 1 NOT NULL`,
//    `is_locked NUMBER(1) DEFAULT 0 NOT NULL`.
//  - app/api/data/route.ts: `isPublished: ch.is_published !== false`, `isLocked: ch.is_locked === true`
//    (a row without the column is read as published and unlocked).
//  - git history: `git log -S"CREATE TABLE IF NOT EXISTS <t>" -- lib/db.ts` shows each table below was first created by a feature
//    commit (teacher_private_lesson_availability / private_lesson_requests: 14c982f 2026-09-04;
//    course_announcements / lesson_live_broadcasts: 4d7a689 2026-09-08). No earlier table was renamed into them.

/** Canonical tables introduced by newer features. Absent in an older source => source rows = 0, target stays empty. */
const NEWER_FEATURE_TABLES = {
  course_announcements: "introduced by commit 4d7a689 (2026-09-08), course announcements",
  teacher_private_lesson_availability: "introduced by commit 14c982f (2026-09-04), private lessons",
  private_lesson_requests: "introduced by commit 14c982f (2026-09-04), private lessons",
  lesson_live_broadcasts: "introduced by commit 4d7a689 (2026-09-08), lesson live broadcasts",
};

/** Canonical columns added by migrateDatabase() after the table existed. Absent in an older source => canonical default. */
const MISSING_COLUMN_DEFAULTS = {
  chapters: {
    is_published: { value: true, source_default: "TRUE", oracle: "NUMBER(1) DEFAULT 1 NOT NULL" },
    is_locked: { value: false, source_default: "FALSE", oracle: "NUMBER(1) DEFAULT 0 NOT NULL" },
  },
  topics: {
    is_published: { value: true, source_default: "TRUE", oracle: "NUMBER(1) DEFAULT 1 NOT NULL" },
    is_locked: { value: false, source_default: "FALSE", oracle: "NUMBER(1) DEFAULT 0 NOT NULL" },
  },
};

module.exports = { NEWER_FEATURE_TABLES, MISSING_COLUMN_DEFAULTS };
