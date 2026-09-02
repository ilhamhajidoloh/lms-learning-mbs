import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  allowExitOnIdle: true, // Allow the pool to close connections when idle (important for serverless)
});

// Keep-alive ping to prevent cold starts
let lastPing = 0;
const PING_INTERVAL = 60000; // 1 minute

async function keepAlive() {
  const now = Date.now();
  if (now - lastPing > PING_INTERVAL) {
    try {
      await pool.query("SELECT 1");
      lastPing = now;
    } catch (err) {
      console.error("Keep-alive ping failed:", err);
    }
  }
}

let migrated = false;

// ฟังก์ชันตรวจสอบว่าตารางมีอยู่ใน database หรือไม่
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0]?.exists || false;
  } catch (err) {
    console.error(`Error checking table '${tableName}':`, err);
    return false;
  }
}

// ตรวจสอบว่า Database เชื่อมต่อได้
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT NOW()");
    return true;
  } catch (err) {
    console.error("Database connection failed:", err);
    return false;
  }
}

/**
 * Kept as a compatibility no-op while API routes are migrated away from
 * runtime schema setup. Database migrations must run during deployment via
 * `npm run db:migrate`, never while serving a user request.
 */
export async function ensureTables(): Promise<void> {}

export async function migrateDatabase() {
  if (migrated) return;

  // Keep-alive ping
  await keepAlive();

  // ตรวจสอบการเชื่อมต่อ
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    throw new Error("Cannot connect to database. Please check DATABASE_URL in .env.local");
  }

  migrated = true;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT        NOT NULL UNIQUE,
      password_hash TEXT        NOT NULL,
      username      TEXT        NOT NULL UNIQUE,
      display_name  TEXT        NOT NULL,
      role          TEXT        NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
      password_changed BOOLEAN  NOT NULL DEFAULT FALSE,
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
    await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS enroll_code TEXT`);
    await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS show_scores BOOLEAN NOT NULL DEFAULT TRUE`);
    await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS sequential_lessons BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS quiz_review_mode TEXT NOT NULL DEFAULT 'full'`);
  } catch (err) {
    console.error("Failed to add course columns:", err);
  }

  // Add password_changed column if not exist
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed BOOLEAN NOT NULL DEFAULT FALSE`);
  } catch (err) {
    console.error("Failed to add column password_changed:", err);
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
    CREATE TABLE IF NOT EXISTS chapters (
      id          TEXT        PRIMARY KEY,
      course_id   TEXT        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title       TEXT        NOT NULL,
      sort_order  INT         NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS topics (
      id          TEXT        PRIMARY KEY,
      chapter_id  TEXT        NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      title       TEXT        NOT NULL,
      sort_order  INT         NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lessons (
      id          TEXT        PRIMARY KEY,
      topic_id    TEXT        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
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
      question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'fill_blank', 'matching', 'essay')),
      options       JSONB NOT NULL DEFAULT '[]',
      correct_index INT   CHECK (correct_index >= 0),
      correct_indices JSONB,
      correct_answer TEXT,
      matching_pairs JSONB,
      explanation   TEXT  NOT NULL DEFAULT '',
      points        NUMERIC NOT NULL DEFAULT 1,
      is_required   BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order    INT   NOT NULL DEFAULT 0
    )
  `);

  // Ensure quiz_questions has essay type and points column
  try {
    await pool.query(`ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check`);
    await pool.query(`ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_question_type_check CHECK (question_type IN ('multiple_choice', 'fill_blank', 'matching', 'essay'))`);
    await pool.query(`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS points NUMERIC NOT NULL DEFAULT 1`);
    await pool.query(`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS correct_indices JSONB`);
  } catch (err) {
    console.error("Failed to update quiz_questions columns/constraints:", err);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id TEXT        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type          TEXT        NOT NULL CHECK (type IN ('file', 'quiz')),
      file_name     TEXT,
      file_path     TEXT,
      score         NUMERIC     CHECK (score >= 0),
      question_scores JSONB,
      answers       JSONB,
      submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Add previous_score column if not exists
  // Note: score column is already defined as NUMERIC in CREATE TABLE above (line 226).
  // If you have an old database with score as INT, run fix-score-column.sql manually.
  try {
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS previous_score NUMERIC`);
  } catch (err) {
    console.error("Failed to add previous_score column:", err);
  }

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_classes (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id        TEXT        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      lesson_id        TEXT        REFERENCES lessons(id) ON DELETE SET NULL,
      room_name        TEXT        UNIQUE NOT NULL,
      title            TEXT        NOT NULL,
      description      TEXT,
      scheduled_at     TIMESTAMPTZ,
      duration_minutes INT         DEFAULT 60,
      host_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_active        BOOLEAN     DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_class_participants (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      live_class_id    UUID        NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
      user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at        TIMESTAMPTZ DEFAULT now(),
      left_at          TIMESTAMPTZ,
      duration_seconds INT,
      UNIQUE(live_class_id, user_id)
    )
  `);

  const lessonMigrations = [
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS topic_id TEXT REFERENCES topics(id) ON DELETE CASCADE`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(id) ON DELETE CASCADE`,
    `ALTER TABLE lessons ALTER COLUMN course_id DROP NOT NULL`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE`,
  ];

  for (const query of lessonMigrations) {
    try {
      await pool.query(query);
    } catch (err) {
      console.error("Failed to apply lessons table migration:", query, err);
    }
  }

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_student    ON course_enrollments (student_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_course     ON course_enrollments (course_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chapters_course        ON chapters (course_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_topics_chapter         ON topics (chapter_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lessons_topic          ON lessons (topic_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_segments_lesson        ON lesson_segments (lesson_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_assignments_course     ON assignments (course_id)`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS show_scores BOOLEAN NOT NULL DEFAULT TRUE`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS quiz_review_mode TEXT NOT NULL DEFAULT 'full'`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS allow_edit_submission BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS allow_cancel_submission BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS quiz_attempt_limit INT`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS open_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS close_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice'`);
  await pool.query(`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS correct_answer TEXT`);
  await pool.query(`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS matching_pairs JSONB`);
  await pool.query(`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE`);
  await pool.query(`ALTER TABLE quiz_questions ALTER COLUMN correct_index DROP NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quiz_questions_assign  ON quiz_questions (assignment_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions (assignment_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_student    ON submissions (student_id)`);
  await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS previous_score NUMERIC`);
  await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS question_scores JSONB`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meetings_created_by    ON meetings (created_by)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meetings_start         ON meetings (start_datetime DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_completions_student    ON student_lesson_completions (student_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_completions_lesson     ON student_lesson_completions (lesson_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_classes_active    ON live_classes (is_active, course_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_classes_course    ON live_classes (course_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_classes_scheduled ON live_classes (scheduled_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_participants_live_class ON live_class_participants (live_class_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_participants_user       ON live_class_participants (user_id)`);

  // ตรวจสอบว่าตารางทั้งหมดถูกสร้างแล้ว
  const requiredTables = [
    "users",
    "courses",
    "course_levels",
    "course_enrollments",
    "chapters",
    "topics",
    "lessons",
    "lesson_segments",
    "assignments",
    "quiz_questions",
    "submissions",
    "meetings",
    "student_lesson_completions",
    "live_classes",
    "live_class_participants"
  ];

  console.log("Verifying database tables...");
  for (const table of requiredTables) {
    const exists = await checkTableExists(table);
    if (exists) {
      console.log(`✓ Table '${table}' exists`);
    } else {
      throw new Error(`✗ Failed to create table '${table}'. Please check your database.`);
    }
  }
  console.log("✓ All required tables are ready!");
}

export default pool;
