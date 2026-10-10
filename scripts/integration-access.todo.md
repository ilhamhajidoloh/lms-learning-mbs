# Integration cases that need a real database (not run in Phase 2)

Offline tests (`node scripts/test-access-policy.cjs`) cover the pure rules only. Run these against a disposable
PostgreSQL and a disposable Oracle schema with migrations 012-015 applied:

- Student M1 / M2 / NULL level vs lesson, assignment and announcement rows (including '' target_group on Postgres).
- Non-enrolled student: GET /api/data, POST /api/submissions, POST /api/lessons/complete, GET /api/lesson-live?lesson_id.
- Assignment under an M2 lesson is hidden from M1 students and cannot be submitted to.
- Teacher B cannot POST/PUT/DELETE chapters, topics, lessons, assignments or grade submissions of teacher A's course.
- Cross-course injection: lesson create with topicId from course B and courseId of course A -> 404; assignment lessonId from another course -> 404.
- Oracle and Postgres return identical status codes for the above.

## Phase 3B (class context CRUD) - needs a real database
- POST/PUT/DELETE /api/lessons, /api/assignments with classContext against Postgres and Oracle (enrolled-level lookup uses TRIM(users.student_level)).
- Chapter/Topic DELETE 409 when a lesson or assignment of another class (or shared) exists below it.
- Stale classContext after the last student of that class leaves the course returns 409.

## Phase 3C status
- PostgreSQL: `TEST_DATABASE_URL=postgresql://.../lms_it_<name> npm run db:test:multiclass:postgres` (49 tests; refuses non-local or non lms_it_* databases).
- Oracle: BLOCKED. Needs a throwaway schema: set ORACLE_USER=LMS_IT_*, ORACLE_PASSWORD, ORACLE_CONNECT_STRING (+ wallet), IT_ORACLE_ISOLATED=yes, run `npm run db:migrate:oracle` against it, then `npm run db:test:multiclass:oracle`.
