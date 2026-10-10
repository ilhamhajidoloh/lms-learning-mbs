import { isVisibleToClass, normalizeTargetGroup } from "./targetGroup";

/**
 * Pure (database-free) access rules for multi-class content. DB lookups live in courseAccess.ts and feed
 * these functions, so the rules can be tested offline.
 *
 * - users.student_level is the only source of a student's class; group_name is never consulted.
 * - A child is visible only if it passes its own target_group AND every ancestor's target_group,
 *   so a child can narrow its parent but can never widen it.
 */

/** Visible iff each group in the chain is shared (NULL/blank) or equals the student's level. */
export function passesGroupChain(studentLevel: unknown, groups: readonly unknown[]): boolean {
  return groups.every((group) => isVisibleToClass(group, studentLevel));
}

export interface ReadDecisionInput {
  role: string;
  ownsCourse: boolean;
  enrolled: boolean;
  studentLevel: unknown;
  /** Own group first, then ancestors (e.g. [assignment.target_group, lesson.target_group]). */
  targetGroups: readonly unknown[];
}

export function canReadCourseContent(input: ReadDecisionInput): boolean {
  if (input.role === "admin") return true;
  if (input.role === "teacher") return input.ownsCourse;
  if (input.role === "student") return input.enrolled && passesGroupChain(input.studentLevel, input.targetGroups);
  return false;
}

export function canManageCourseContent(role: string, ownsCourse: boolean): boolean {
  if (role === "admin") return true;
  if (role === "teacher") return ownsCourse;
  return false;
}

/**
 * Group stored on a new child. When the parent is class-specific the child takes the parent's group and the
 * client value is ignored; when the parent is shared the child may narrow to the requested group.
 */
export function childTargetGroupOnCreate(parentGroup: unknown, requestedGroup: unknown): string | null {
  return normalizeTargetGroup(parentGroup) ?? normalizeTargetGroup(requestedGroup);
}

/** A parent id supplied by the client must belong to the same course as the course being written to. */
export function isSameCourse(expectedCourseId: unknown, actualCourseId: unknown): boolean {
  return typeof expectedCourseId === "string" && expectedCourseId !== "" && expectedCourseId === actualCourseId;
}

export type ClassContextCheck = { ok: true; classContext: string } | { ok: false; status: number; error: string };

/**
 * Phase 3B: a content write must carry the teacher's selected class. "all" (or nothing) is read-only, and the class
 * must be one of the levels of students really enrolled in the course (a stale selection is rejected, not guessed).
 */
export function checkClassContext(raw: unknown, enrolledLevels: readonly string[]): ClassContextCheck {
  const ctx = normalizeTargetGroup(raw);
  if (ctx === null || ctx === "all") return { ok: false, status: 400, error: "ต้องเลือกชั้นเรียนก่อนจัดการเนื้อหา (class context required)" };
  if (!enrolledLevels.some((level) => normalizeTargetGroup(level) === ctx)) {
    return { ok: false, status: 409, error: "ชั้นเรียนนี้ไม่มีนักเรียนลงทะเบียนในคอร์ส (stale class context)" };
  }
  return { ok: true, classContext: ctx };
}

/**
 * Edit/delete of class content. `ownGroup` must be exactly the class context (shared content and other classes are
 * refused); `ancestorGroups` (e.g. the parent lesson) may be shared or the same class, never another class.
 */
export function canWriteClassContent(ownGroup: unknown, classContext: string, ancestorGroups: readonly unknown[] = []): boolean {
  const own = normalizeTargetGroup(ownGroup);
  if (own === null || own !== classContext) return false;
  return ancestorGroups.every((group) => {
    const g = normalizeTargetGroup(group);
    return g === null || g === classContext;
  });
}

/** Shared structure (chapter/topic) may be deleted only when everything inside it belongs to the selected class. */
export function canDeleteSharedStructure(containedGroups: readonly unknown[], classContext: string): boolean {
  return containedGroups.every((group) => normalizeTargetGroup(group) === classContext);
}

/**
 * What happens to a lesson's assignments/quizzes when the lesson's class changes.
 * - New class-specific group (M1->M2, shared->M1): children are moved to the new group.
 * - Back to shared (M1->NULL): children keep their group, so nothing becomes visible by accident.
 * - Unchanged: nothing to do.
 * Independent assignments (lesson_id IS NULL) are never selected by the cascade.
 */
export function lessonGroupCascade(oldGroup: unknown, newGroup: unknown): { cascade: boolean; group: string | null } {
  const before = normalizeTargetGroup(oldGroup);
  const after = normalizeTargetGroup(newGroup);
  if (after === null || after === before) return { cascade: false, group: null };
  return { cascade: true, group: after };
}
