import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

let migrated = false;

export async function ensureTables() {
  if (migrated) return;
  migrated = true;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT        NOT NULL UNIQUE,
      password_hash TEXT        NOT NULL,
      username      TEXT        NOT NULL UNIQUE,
      display_name  TEXT        NOT NULL,
      role          TEXT        NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id             TEXT        PRIMARY KEY,
      title          TEXT        NOT NULL,
      level          TEXT        NOT NULL,
      level_label    TEXT        NOT NULL,
      gradient_class TEXT        NOT NULL DEFAULT 'from-indigo-500 to-purple-600',
      instructor_id  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Dynamically drop level CHECK constraint from courses table if it exists
  try {
    const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as def 
      FROM pg_constraint 
      WHERE conrelid = 'courses'::regclass AND contype = 'c'
    `);
    for (const row of res.rows) {
      if (row.def && row.def.includes("level")) {
        await pool.query(`ALTER TABLE courses DROP CONSTRAINT IF EXISTS ${row.conname}`);
      }
    }
  } catch (err) {
    console.error("Failed to drop level check constraint:", err);
  }

  // Add columns for course enrollment settings if not exist
  try {
    await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT FALSE`);
  } catch (err) {
    console.error("Failed to add column is_open:", err);
  }
  try {
    await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS enroll_code TEXT`);
  } catch (err) {
    console.error("Failed to add column enroll_code:", err);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_levels (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      value      TEXT        NOT NULL UNIQUE,
      label      TEXT        NOT NULL,
      sort_order INT         NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_enrollments (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id   TEXT        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      progress    INT         NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (course_id, student_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lessons (
      id          TEXT        PRIMARY KEY,
      course_id   TEXT        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title       TEXT        NOT NULL,
      description TEXT        NOT NULL DEFAULT '',
      video_url   TEXT,
      sort_order  INT         NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_segments (
      id         TEXT PRIMARY KEY,
      lesson_id  TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      duration   TEXT NOT NULL DEFAULT '00:00',
      sort_order INT  NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id           TEXT        PRIMARY KEY,
      course_id    TEXT        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      created_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      type         TEXT        NOT NULL CHECK (type IN ('file', 'quiz')),
      title        TEXT        NOT NULL,
      due_date     DATE        NOT NULL,
      points       INT         NOT NULL DEFAULT 10 CHECK (points > 0),
      instructions TEXT,
      time_limit   INT         CHECK (time_limit > 0),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      options       JSONB NOT NULL DEFAULT '[]',
      correct_index INT   NOT NULL CHECK (correct_index >= 0),
      explanation   TEXT  NOT NULL DEFAULT '',
      sort_order    INT   NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id TEXT        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type          TEXT        NOT NULL CHECK (type IN ('file', 'quiz')),
      file_name     TEXT,
      file_path     TEXT,
      score         INT         CHECK (score >= 0),
      answers       JSONB,
      submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id             TEXT        PRIMARY KEY,
      created_by     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      subject        TEXT        NOT NULL,
      join_url       TEXT        NOT NULL,
      start_datetime TIMESTAMPTZ NOT NULL,
      end_datetime   TIMESTAMPTZ NOT NULL,
      passcode       TEXT        NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_lesson_completions (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id    TEXT        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (student_id, lesson_id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_student    ON course_enrollments (student_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_course     ON course_enrollments (course_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lessons_course         ON lessons (course_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_segments_lesson        ON lesson_segments (lesson_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_assignments_course     ON assignments (course_id)`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quiz_questions_assign  ON quiz_questions (assignment_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions (assignment_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_student    ON submissions (student_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meetings_created_by    ON meetings (created_by)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meetings_start         ON meetings (start_datetime DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_completions_student    ON student_lesson_completions (student_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_completions_lesson     ON student_lesson_completions (lesson_id)`);
}

export default pool;
