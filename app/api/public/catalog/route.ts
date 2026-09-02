import pool from "@/lib/db";

export const revalidate = 60;

export async function GET() {
  try {
    const [coursesResult, levelsResult] = await Promise.all([
      pool.query(`
        SELECT c.id, c.title, c.level, c.level_label, c.gradient_class,
               u.display_name AS instructor_name
        FROM courses c
        JOIN users u ON u.id = c.instructor_id
        ORDER BY c.created_at DESC
        LIMIT 100
      `),
      pool.query(`
        SELECT id, value, label
        FROM course_levels
        ORDER BY sort_order, label
        LIMIT 100
      `),
    ]);

    return Response.json({
      courses: coursesResult.rows.map((course) => ({
        id: course.id,
        title: course.title,
        level: course.level,
        levelLabel: course.level_label,
        gradientClass: course.gradient_class,
        instructor: course.instructor_name,
      })),
      levels: levelsResult.rows.map((level) => ({
        id: level.id,
        value: level.value,
        label: level.label,
      })),
    });
  } catch (error) {
    console.error("GET /api/public/catalog failed:", error);
    return Response.json({ error: "Unable to load course catalog" }, { status: 500 });
  }
}
