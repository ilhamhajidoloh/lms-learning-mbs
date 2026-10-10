# แผนปรับ LMS: 1 Course รองรับหลายชั้นเรียน (Preflight)

วันที่ตรวจ: 2026-10-10 | Repo: `front-lms` (git root อยู่ที่ `front-lms/` ไม่ใช่ `E:\lms_mathbyseng`)

## 1. Git
- Branch: `main` (tracking `origin/main`), HEAD `f3a75bb`
- Working tree ไม่สะอาด: 18 ไฟล์ modified + 4 untracked (`app/api/courses/classes/`, migration Oracle 012, 013, 014) ซึ่งเป็นงานค้างที่เริ่มทำ multi-class ไว้แล้วบางส่วน (ยังไม่ commit)

## 2. Database Provider
- `lib/database/config.ts`: อ่าน `DB_PROVIDER` (`postgres` | `oracle`), ถ้าไม่ตั้งค่าจะ throw
- `.env.local` และ `.env.example` = `postgres` (เป็นค่า local เท่านั้น)
- **ยืนยันไม่ได้ว่า Production ใช้ Oracle**: ไม่มี `DB_PROVIDER` ใน `vercel.json` และไม่ได้ตรวจ env บน Vercel (ไม่มีสิทธิ์/ไม่ได้ขอ). ต้องให้ผู้ใช้ยืนยัน
- โค้ดต้องรองรับ 2 dialect: Postgres ใช้ `$1` + array, Oracle ใช้ `:name` + object, ผลลัพธ์ Oracle ต้อง `lowerKeys()`

## 3. Schema ที่เกี่ยวข้อง
| ตาราง | หมายเหตุ |
|---|---|
| courses, course_levels | course ผูก level; `instructor_id` |
| course_enrollments | มี `group_name` (เพิ่มใน 012, ยังไม่ commit) |
| users | มี `student_level` (013, ยังไม่ commit) แทน student profile |
| chapters -> topics -> lessons -> lesson_segments | "sublesson" = lesson_segments (ยืนยันชื่อในโค้ดอีกครั้งก่อนแก้) |
| assignments, quiz_questions, submissions | quiz เป็น assignment type |
| course_announcements | ยังไม่มี target |
| course_class_levels | ใหม่ (014): `(course_id, level_value)` PK, FK -> courses ON DELETE CASCADE |

## 4. target_group ที่มีอยู่
- `lessons.target_group` (TEXT / VARCHAR2(255))
- `assignments.target_group`
- ไม่มีใน: chapters, topics, lesson_segments, quiz_questions, course_announcements
- ที่ใช้งาน: `app/api/data/route.ts` (กรองฝั่งนักเรียน, บรรทัด ~240), `lessons/route.ts`, `assignments/route.ts`, `submissions/route.ts` (เทียบกับ `users.student_level`)
- Postgres เพิ่มผ่าน `lib/db.ts` (บรรทัด ~404, 439); Oracle ผ่าน 012

## 5. ระบบ migration
- Postgres: `npm run db:migrate` -> `scripts/migrate.cjs` -> `migrateDatabase()` ใน `lib/db.ts` (`CREATE/ALTER ... IF NOT EXISTS` idempotent, ไม่มี version table)
- Oracle: `npm run db:migrate:oracle` -> `database/oracle/runner/migrate.cjs`, ไฟล์ `database/oracle/migrations/001..014` แยกด้วย `-- @statement`
- ความเสี่ยง: ไม่มีคู่ migration ที่ sync อัตโนมัติ ต้องเขียนทั้ง 2 ฝั่งเอง; `ALTER TABLE ADD` ของ Oracle ไม่ idempotent
- ไม่ได้รัน migration ใดๆ ในขั้นตอนนี้

## 6. API / UI หน้ารายละเอียดคอร์ส
- API: `app/api/data/route.ts` (โหลดรวม), `courses/route.ts`, `courses/enroll/route.ts`, `courses/classes/route.ts` (ใหม่), `lessons`, `assignments`, `submissions`, `announcements`, `topics`, `chapters`, `profiles`, `admin/users`
- UI ครู: `app/teacher/page.tsx`, `_components/CourseDetailPanel.tsx`, `CourseCreationModal.tsx`, `CourseEditModal.tsx`, `CourseEnrollSettingsModal.tsx`, `AddLessonModal.tsx`, `LessonEditModal.tsx`, `AssignmentFormModal.tsx`, `EditAssignmentModal.tsx`, `StudentsPanel.tsx`
- UI นักเรียน: `app/student/page.tsx`, `_components/CoursesTab.tsx`, `StudyTab.tsx`, `TaskListPanel.tsx`
- UI admin: `app/admin/page.tsx`, `_components/UserFormModal.tsx`; context: `app/context/UserContext.tsx`

## 7. ผล lint / typecheck / build
- `npm run lint`: 0 errors, 14 warnings (unused vars ฯลฯ)
- `npx tsc --noEmit`: **2 errors** (อยู่ในงานค้างที่ยังไม่ commit)
  - `app/api/courses/classes/route.ts:37` type `string | false` ไม่ตรง boolean ใน filter
  - `app/teacher/page.tsx:218` ขาด prop `levels` ของ `CourseCreationModal`
- `npm run build`: **ล้มเหลว** ด้วย error ข้อแรกข้างบน
- สรุป: baseline ที่ HEAD ไม่ได้ทดสอบแยก; ความล้มเหลวมาจากงานค้างใน working tree

## 8. ความเสี่ยง
1. Working tree มีงานค้าง 22 ไฟล์ ต้องตัดสินใจว่าจะใช้ต่อ, stash หรือ commit แยกก่อนเริ่ม Phase 1
2. Production provider ยังไม่ยืนยัน; ถ้าเป็น Oracle ต้องรัน 012-014 ก่อน deploy โค้ดที่อ้างคอลัมน์ใหม่ ไม่งั้น query พัง
3. ชื่อชั้นเรียนเป็น string อิสระ (`student_level`, `group_name`, `target_group`) ไม่มี FK/normalize -> สะกดไม่ตรงทำให้เนื้อหาหาย
4. `submissions` เทียบ `target_group` กับ `student_level` ส่วน enrollment ใช้ `group_name` -> ความหมายซ้ำซ้อน ต้องกำหนดแหล่งความจริงเดียว
5. ไม่มี target_group ใน announcements/topics/chapters/segments/quiz
6. Dual-dialect SQL: ต้องแก้ทุกจุดสองแบบและมีแนวโน้มลืมฝั่งใดฝั่งหนึ่ง
7. ข้อมูลนักเรียนเดิมที่ `student_level` เป็น NULL จะเห็นเนื้อหาอย่างไร (ต้องกำหนดกฎ)
8. มีโฟลเดอร์ `phase8-production*` ซ้ำในโฟลเดอร์แม่ อาจสับสนเรื่อง source of truth

## 9. แผนเป็น Phase
- **Phase 0**: ตัดสินใจเรื่องงานค้าง, ยืนยัน production provider, backup, แก้ type error 2 จุดให้ build ผ่าน
- **Phase 1 (Schema + API พื้นฐาน)**: ตกลงโมเดล (course_class_levels เป็นรายการชั้นของคอร์ส, enrollment เก็บชั้นของนักเรียนในคอร์สนั้น), เพิ่ม target_group ที่ขาด (announcements ก่อน), migration คู่ Postgres/Oracle, ปรับ `courses`, `courses/classes`, `courses/enroll`, `data`
- **Phase 2 (Filtering)**: กรองเนื้อหาตามชั้นของนักเรียนใน lessons/assignments/quiz/announcements/submissions ให้เป็นกฎเดียวที่ใช้ซ้ำ
- **Phase 3 (UI ครู/แอดมิน)**: เลือกหลายชั้นตอนสร้าง/แก้คอร์ส, ตัวเลือกชั้นในฟอร์มบทเรียน/งาน/ประกาศ, มุมมองนักเรียนแยกชั้น
- **Phase 4 (UI นักเรียน)**: แสดงเฉพาะเนื้อหาของชั้นตน
- **Phase 5**: backfill ข้อมูลเดิม, ทดสอบทั้ง 2 provider, rollout (migration ก่อน แล้วค่อย deploy)

## 10. ไฟล์ที่ต้องแก้ใน Phase 1
- `lib/db.ts` (Postgres migration)
- `database/oracle/migrations/012-014` (ทบทวน) + ไฟล์ใหม่สำหรับ announcements
- `app/api/courses/route.ts`, `app/api/courses/classes/route.ts`, `app/api/courses/enroll/route.ts`
- `app/api/announcements/route.ts`, `app/api/data/route.ts`
- แก้ build: `app/api/courses/classes/route.ts`, `app/teacher/page.tsx`
- (ถ้า Oracle มี schema validator) `scripts/validate-oracle-schema.cjs`, `database/migration/*.json`

## 11. คำถามที่ต้องตัดสินใจ
1. Production ใช้ `DB_PROVIDER` อะไรอยู่จริง และ Oracle schema ถูกรัน 012-014 แล้วหรือยัง
2. งานค้าง 22 ไฟล์: ใช้ต่อ / stash / ทิ้ง
3. นักเรียนมี "ชั้น" หนึ่งค่าต่อ user (`student_level`) หรือหนึ่งค่าต่อ enrollment (`group_name`)
4. เนื้อหาที่ `target_group` ว่าง = เห็นทุกชั้น ใช่หรือไม่
5. ชั้นเป็นรายการตายตัว (ตาราง class) หรือ string อิสระ
6. ต้องการ target_group ระดับ topic/chapter หรือแค่ lesson/assignment/announcement
