import { query, getDbProvider, lowerKeys } from "@/lib/database";

export const revalidate = 60;

type CourseRow = { id: string; title: string; level: string; level_label: string; gradient_class: string; instructor_name: string };
type LevelRow = { id: string; value: string; label: string };

export async function GET() {
  try {
    const oracle = getDbProvider() === "oracle";
    // Oracle: LEVEL is reserved, so the compatibility aliases are quoted; both restore the API's `level` / `value`.
    const [coursesResult, levelsResult] = await Promise.all([
      oracle
        ? query<CourseRow>(`
            SELECT c.id, c.title, c.course_level AS "level", c.level_label, c.gradient_class,
                   u.display_name AS instructor_name
            FROM courses c
            JOIN users u ON u.id = c.instructor_id
            WHERE c.course_level = 'all'
            ORDER BY c.created_at DESC
            FETCH FIRST 100 ROWS ONLY
          `)
        : query<CourseRow>(`
            SELECT c.id, c.title, c.level, c.level_label, c.gradient_class,
                   u.display_name AS instructor_name
            FROM courses c
            JOIN users u ON u.id = c.instructor_id
            WHERE c.level = 'all'
            ORDER BY c.created_at DESC
            LIMIT 100
          `),
      oracle
        ? query<LevelRow>(`
            SELECT id, level_value AS "value", label
            FROM course_levels
            ORDER BY sort_order, label
            FETCH FIRST 100 ROWS ONLY
          `)
        : query<LevelRow>(`
            SELECT id, value, label
            FROM course_levels
            ORDER BY sort_order, label
            LIMIT 100
          `),
    ]);

    return Response.json({
      courses: coursesResult.rows.map((row) => {
        const course = lowerKeys(row) as CourseRow;
        return {
          id: course.id,
          title: course.title,
          level: course.level,
          levelLabel: course.level_label,
          gradientClass: course.gradient_class,
          instructor: course.instructor_name,
        };
      }),
      levels: levelsResult.rows.map((row) => {
        const level = lowerKeys(row) as LevelRow;
        return { id: level.id, value: level.value, label: level.label };
      }),
    });
  } catch (error) {
    console.error("GET /api/public/catalog failed:", error);
    return Response.json({ error: "Unable to load course catalog" }, { status: 500 });
  }
}
