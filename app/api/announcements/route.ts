import { query, getDbProvider, normalizeEmptyText, lowerKeys, runForProvider } from "@/lib/database";
import { authenticate, type JwtPayload } from "@/lib/auth";
import { randomUUID } from "crypto";
import { isVisibleToClass, normalizeTargetGroup } from "@/lib/targetGroup";
import { assertCanManageCourse, getEnrollmentLevel, getEnrolledClassLevels, getCourseInstructorId, requireClassContext } from "@/lib/courseAccess";

type AnnouncementRow = { id: string; course_id: string; title: string; body: string | null; target_group: string | null; created_at: Date; updated_at: Date };
const record = (row: unknown) => lowerKeys(row as Record<string, unknown>)! as AnnouncementRow;
const dto = (row: AnnouncementRow) => ({ ...row, body: normalizeEmptyText(row.body), target_group: normalizeTargetGroup(row.target_group) });

async function canReadCourse(auth: JwtPayload, courseId: string) {
  if (auth.role === "admin") return true;
  if (auth.role === "teacher") return (await getCourseInstructorId(courseId)) === auth.userId;
  return auth.role === "student" && (await getEnrollmentLevel(auth.userId, courseId)).enrolled;
}

// Announcement management accepts the global context; other content routes deliberately do not.
async function classContext(courseId: string, raw: unknown): Promise<Response | "all" | string> {
  if (raw === undefined || raw === null || raw === "" || normalizeTargetGroup(raw) === "all") return "all";
  return requireClassContext(courseId, raw);
}

async function findAnnouncement(id: string): Promise<AnnouncementRow | null> {
  const result = await runForProvider({ query },
    { sql: "SELECT id, course_id, title, body, target_group, created_at, updated_at FROM course_announcements WHERE id = :id", binds: { id } },
    { sql: "SELECT id, course_id, title, body, target_group, created_at, updated_at FROM course_announcements WHERE id = $1", binds: [id] });
  return result.rows[0] ? record(result.rows[0]) : null;
}

export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams, courseId = params.get("courseId");
  if (!courseId) return Response.json({ error: "Missing course id" }, { status: 400 });
  if (!await canReadCourse(auth, courseId)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const context = auth.role === "student" ? "all" : await classContext(courseId, params.get("classContext"));
  if (typeof context !== "string") return context;
  const provider = getDbProvider();
  const result = await query(provider === "oracle" ? "SELECT id, course_id, title, body, target_group, created_at, updated_at FROM course_announcements WHERE course_id = :courseId ORDER BY created_at DESC" : "SELECT id, course_id, title, body, target_group, created_at, updated_at FROM course_announcements WHERE course_id = $1 ORDER BY created_at DESC", provider === "oracle" ? { courseId } : [courseId]);
  let announcements = result.rows.map((row) => dto(record(row)));
  if (auth.role === "student") {
    const enrollment = await getEnrollmentLevel(auth.userId, courseId);
    announcements = announcements.filter((announcement) => isVisibleToClass(announcement.target_group, enrollment.level));
  } else if (context !== "all") announcements = announcements.filter((announcement) => announcement.target_group === context);
  return Response.json({ announcements });
}

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { courseId, title, body, targetGroup, classContext: rawContext } = await request.json();
  if (!courseId || !String(title || "").trim()) return Response.json({ error: "Course and title are required" }, { status: 400 });
  const access = await assertCanManageCourse(auth, courseId);
  if (access) return access;
  const context = await classContext(courseId, rawContext);
  if (typeof context !== "string") return context;
  const requested = normalizeTargetGroup(targetGroup);
  let group: string | null;
  if (context === "all") {
    if (requested !== null && !(await getEnrolledClassLevels(courseId)).includes(requested)) return Response.json({ error: "Target class is not enrolled in this course" }, { status: 409 });
    group = requested;
  } else {
    if (requested !== null && requested !== context) return Response.json({ error: "target_group must match the selected class" }, { status: 400 });
    group = context;
  }
  const provider = getDbProvider(), id = randomUUID(), cleanTitle = String(title).trim(), cleanBody = String(body || "").trim();
  if (provider === "oracle") {
    await query(cleanBody ? "INSERT INTO course_announcements (id, course_id, author_id, title, body, target_group) VALUES (:id, :courseId, :authorId, :title, :body, :targetGroup)" : "INSERT INTO course_announcements (id, course_id, author_id, title, target_group) VALUES (:id, :courseId, :authorId, :title, :targetGroup)", cleanBody ? { id, courseId, authorId: auth.userId, title: cleanTitle, body: cleanBody, targetGroup: group } : { id, courseId, authorId: auth.userId, title: cleanTitle, targetGroup: group });
  } else await query("INSERT INTO course_announcements (id, course_id, author_id, title, body, target_group) VALUES ($1, $2, $3, $4, $5, $6)", [id, courseId, auth.userId, cleanTitle, cleanBody, group]);
  return Response.json({ announcement: dto((await findAnnouncement(id))!) }, { status: 201 });
}

async function writeAccess(auth: JwtPayload, id: string, rawContext: unknown): Promise<Response | AnnouncementRow> {
  const announcement = await findAnnouncement(id);
  if (!announcement) return Response.json({ error: "Announcement not found" }, { status: 404 });
  const access = await assertCanManageCourse(auth, announcement.course_id);
  if (access) return access;
  const context = await classContext(announcement.course_id, rawContext);
  if (typeof context !== "string") return context;
  if (context !== "all" && normalizeTargetGroup(announcement.target_group) !== context) return Response.json({ error: "Announcement is outside the selected class" }, { status: 403 });
  return announcement;
}

export async function PUT(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, title, body, targetGroup, classContext: rawContext } = await request.json();
  if (!id || !String(title || "").trim()) return Response.json({ error: "Announcement title is required" }, { status: 400 });
  if (targetGroup !== undefined) return Response.json({ error: "target_group cannot be changed from the edit form" }, { status: 400 });
  const allowed = await writeAccess(auth, id, rawContext);
  if (allowed instanceof Response) return allowed;
  const provider = getDbProvider(), cleanTitle = String(title).trim(), cleanBody = String(body || "").trim();
  await query(provider === "oracle" ? (cleanBody ? "UPDATE course_announcements SET title = :title, body = :body, updated_at = SYSTIMESTAMP WHERE id = :id" : "UPDATE course_announcements SET title = :title, body = EMPTY_CLOB(), updated_at = SYSTIMESTAMP WHERE id = :id") : "UPDATE course_announcements SET title = $1, body = $2, updated_at = now() WHERE id = $3", provider === "oracle" ? (cleanBody ? { id, title: cleanTitle, body: cleanBody } : { id, title: cleanTitle }) : [cleanTitle, cleanBody, id]);
  return Response.json({ announcement: dto((await findAnnouncement(id))!) });
}

export async function DELETE(request: Request) {
  const auth = authenticate(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams, id = params.get("id");
  if (!id) return Response.json({ error: "Missing announcement id" }, { status: 400 });
  const allowed = await writeAccess(auth, id, params.get("classContext"));
  if (allowed instanceof Response) return allowed;
  const provider = getDbProvider();
  await query(provider === "oracle" ? "DELETE FROM course_announcements WHERE id = :id" : "DELETE FROM course_announcements WHERE id = $1", provider === "oracle" ? { id } : [id]);
  return Response.json({ success: true });
}
