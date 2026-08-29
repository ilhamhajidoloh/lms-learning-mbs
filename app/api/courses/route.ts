import pool, { ensureTables } from "@/lib/db";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, level, levelLabel, gradientClass } = await request.json();

  const { rows } = await pool.query(
    `INSERT INTO courses (id, title, level, level_label, gradient_class, instructor_id, is_open, enroll_code)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE, NULL)
     RETURNING id`,
    [id || `course-${Date.now()}`, title, level, levelLabel, gradientClass, auth.userId]
  );

  return Response.json({ id: rows[0].id });
}

export async function PUT(request: Request) {
  await ensureTables();
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, isOpen, enrollCode, level, levelLabel, showScores, sequentialLessons, quizReviewMode } = await request.json();
  if (!id) return Response.json({ error: "Missing course id" }, { status: 400 });

  const hasMetadataUpdate = level !== undefined || levelLabel !== undefined;

  if (hasMetadataUpdate) {
    if (auth.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.query(
      `UPDATE courses
       SET level = COALESCE($1, level),
           level_label = COALESCE($2, level_label),
           updated_at = now()
       WHERE id = $3`,
      [level ?? null, levelLabel ?? null, id]
    );

    return Response.json({ success: true });
  }

  if (auth.role !== "admin") {
    // Verify requester is instructor
    const courseQuery = await pool.query(
      "SELECT instructor_id FROM courses WHERE id = $1",
      [id]
    );
    if (courseQuery.rows.length === 0) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }
    if (courseQuery.rows[0].instructor_id !== auth.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await pool.query(
    `UPDATE courses
     SET is_open = COALESCE($1, is_open),
         enroll_code = $2,
         show_scores = COALESCE($3, show_scores),
         sequential_lessons = COALESCE($4, sequential_lessons),
         quiz_review_mode = COALESCE($5, quiz_review_mode),
         updated_at = now()
     WHERE id = $6`,
    [
      isOpen !== undefined ? isOpen : null,
      enrollCode || null,
      showScores !== undefined ? showScores : null,
      sequentialLessons !== undefined ? sequentialLessons : null,
      quizReviewMode !== undefined ? quizReviewMode : null,
      id,
    ]
  );

  return Response.json({ success: true });
}
