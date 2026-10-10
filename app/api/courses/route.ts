import { query, getDbProvider, toDbBoolean, lowerKeys } from "@/lib/database";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.role !== "teacher" && auth.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id, title, description, level, levelLabel, gradientClass } = await request.json();
  const provider = getDbProvider();
  const courseId = id || `course-${Date.now()}`;
  // Kept for legacy catalogue fields; newly created courses are multi-class.
  const courseLevel = level || "all";
  const courseLevelLabel = levelLabel || "ทุกชั้นเรียน";

  if (provider === "oracle") {
    await query(
      `INSERT INTO courses (id, title, description, course_level, level_label, gradient_class, instructor_id, is_open, enroll_code)
       VALUES (:id, :title, TO_CLOB(:description), :courseLevel, :levelLabel, :gradientClass, :instructorId, :isOpen, :enrollCode)`,
      {
        id: courseId,
        title,
        description: description || "",
        courseLevel,
        levelLabel: courseLevelLabel,
        gradientClass,
        instructorId: auth.userId,
        isOpen: toDbBoolean(false),
        enrollCode: null,
      }
    );
  } else {
    await query(
      `INSERT INTO courses (id, title, description, level, level_label, gradient_class, instructor_id, is_open, enroll_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NULL)`,
      [courseId, title, description || "", courseLevel, courseLevelLabel, gradientClass, auth.userId]
    );
  }

  return Response.json({ id: courseId });
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return Response.json({ error: "Missing course id" }, { status: 400 });

  const provider = getDbProvider();
  if (auth.role !== "admin") {
    const courseQuery = await query(
      provider === "oracle"
        ? "SELECT instructor_id FROM courses WHERE id = :id"
        : "SELECT instructor_id FROM courses WHERE id = $1",
      provider === "oracle" ? { id } : [id]
    );
    if (courseQuery.rows.length === 0) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }

    const course = (provider === "oracle"
      ? lowerKeys(courseQuery.rows[0] as Record<string, unknown>)
      : courseQuery.rows[0]) as { instructor_id: string };
    if (course.instructor_id !== auth.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await query(
    provider === "oracle"
      ? "DELETE FROM courses WHERE id = :id"
      : "DELETE FROM courses WHERE id = $1",
    provider === "oracle" ? { id } : [id]
  );

  if (result.rowCount === 0) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, description, isOpen, enrollCode, level, levelLabel, gradientClass, showScores, sequentialLessons, quizReviewMode } = await request.json();
  if (!id) return Response.json({ error: "Missing course id" }, { status: 400 });

  const hasDetailsUpdate = title !== undefined || description !== undefined || level !== undefined || levelLabel !== undefined || gradientClass !== undefined;
  const provider = getDbProvider();

  if (hasDetailsUpdate) {
    const courseQuery = await query(
      provider === "oracle"
        ? "SELECT instructor_id FROM courses WHERE id = :id"
        : "SELECT instructor_id FROM courses WHERE id = $1",
      provider === "oracle" ? { id } : [id]
    );
    if (courseQuery.rows.length === 0) return Response.json({ error: "Course not found" }, { status: 404 });
    if (auth.role !== "admin") {
      const course = (provider === "oracle" ? lowerKeys(courseQuery.rows[0] as Record<string, unknown>) : courseQuery.rows[0]) as { instructor_id: string };
      if (course.instructor_id !== auth.userId) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (provider === "oracle") {
      await query(
        `UPDATE courses
         SET title = COALESCE(:title, title),
             description = CASE WHEN :description IS NULL THEN description ELSE TO_CLOB(:description) END,
             course_level = COALESCE(:courseLevel, course_level),
             level_label = COALESCE(:levelLabel, level_label),
             gradient_class = COALESCE(:gradientClass, gradient_class),
             updated_at = SYSTIMESTAMP
         WHERE id = :id`,
        { title: title ?? null, description: description ?? null, courseLevel: level ?? null, levelLabel: levelLabel ?? null, gradientClass: gradientClass ?? null, id }
      );
    } else {
      await query(
        `UPDATE courses
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             level = COALESCE($3, level),
             level_label = COALESCE($4, level_label),
             gradient_class = COALESCE($5, gradient_class),
             updated_at = now()
         WHERE id = $6`,
        [title ?? null, description ?? null, level ?? null, levelLabel ?? null, gradientClass ?? null, id]
      );
    }

    return Response.json({ success: true });
  }

  if (auth.role !== "admin") {
    // Verify requester is instructor
    const courseQuery = await query(
      provider === "oracle"
        ? "SELECT instructor_id FROM courses WHERE id = :id"
        : "SELECT instructor_id FROM courses WHERE id = $1",
      provider === "oracle" ? { id } : [id]
    );
    if (courseQuery.rows.length === 0) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }
    const course = (provider === "oracle" ? lowerKeys(courseQuery.rows[0] as Record<string, unknown>) : courseQuery.rows[0]) as { instructor_id: string };
    if (course.instructor_id !== auth.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (provider === "oracle") {
    await query(
      `UPDATE courses
       SET is_open = COALESCE(CAST(:isOpen AS NUMBER), is_open),
           enroll_code = :enrollCode,
           show_scores = COALESCE(CAST(:showScores AS NUMBER), show_scores),
           sequential_lessons = COALESCE(CAST(:sequentialLessons AS NUMBER), sequential_lessons),
           quiz_review_mode = COALESCE(:quizReviewMode, quiz_review_mode),
           updated_at = SYSTIMESTAMP
       WHERE id = :id`,
      {
        isOpen: isOpen !== undefined ? toDbBoolean(isOpen) : null,
        enrollCode: enrollCode || null,
        showScores: showScores !== undefined ? toDbBoolean(showScores) : null,
        sequentialLessons: sequentialLessons !== undefined ? toDbBoolean(sequentialLessons) : null,
        quizReviewMode: quizReviewMode !== undefined ? quizReviewMode : null,
        id,
      }
    );
  } else {
    await query(
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
  }

  return Response.json({ success: true });
}
