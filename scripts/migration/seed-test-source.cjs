#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// TEST ONLY: seeds a DISPOSABLE local lms_test* PostgreSQL database with representative rows and (with --anomalies)
// deliberate problems so the Phase 4A preflight/export tooling can be exercised. Refuses any other database.
const { Client } = require("pg");
const common = require("./lib/common.cjs");

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function main() {
  common.loadEnv();
  const args = common.parseArgs();
  const { url } = common.resolveSourceUrl(args);
  const id = common.describeUrl(url);
  if (!common.isDisposableTestDb(id)) throw new Error(`Refusing to seed ${id.host}/${id.database}: only local lms_test* databases are allowed`);
  const c = new Client({ connectionString: url, ssl: false });
  await c.connect();
  const x = (sql, p) => c.query(sql, p);
  try {
    await x("TRUNCATE " + Object.keys(common.loadManifest().tables).map((t) => `"${t}"`).join(", ") + " CASCADE");
    const hash = "$2a$10$testhashtesthashtesthashtesthashtesthashtesthashtesth";
    await x(`INSERT INTO users (id,email,password_hash,username,display_name,role,password_changed,created_at) VALUES
      ($1,'t1@example.test',$4,'teacher1','Teacher One','teacher',true,'2026-01-05 10:00:00.123456+07'),
      ($2,'s1@example.test',$4,'student1','Student One','student',false,'2026-01-06 03:00:00+00'),
      ($3,'s2@example.test',$4,'student2','Student Two','student',true,'2026-02-01 00:00:00+00')`, [U(1), U(2), U(3), hash]);
    await x(`INSERT INTO course_levels (id,value,label,sort_order) VALUES ($1,'m1','Mathayom 1',1),($2,'m2','Mathayom 2',2)`, [U(10), U(11)]);
    await x(`INSERT INTO courses (id,title,level,level_label,instructor_id,is_open,show_scores) VALUES ('course-1','Algebra','m1','Mathayom 1',$1,true,true)`, [U(1)]);
    await x(`INSERT INTO course_enrollments (id,course_id,student_id,progress) VALUES ($1,'course-1',$2,40),($3,'course-1',$4,100)`, [U(20), U(2), U(21), U(3)]);
    await x(`INSERT INTO course_announcements (id,course_id,author_id,title,body) VALUES ($1,'course-1',$2,'Welcome',''),($3,'course-1',$2,'Real body','  '),($4,'course-1',$2,'Text','สวัสดี\nline2, "quoted"')`, [U(30), U(1), U(31), U(32)]);
    await x(`INSERT INTO chapters (id,course_id,title,sort_order) VALUES ('ch-1','course-1','Chapter 1',1)`);
    await x(`INSERT INTO topics (id,chapter_id,title,sort_order) VALUES ('tp-1','ch-1','Topic 1',1)`);
    await x(`INSERT INTO lessons (id,topic_id,course_id,title,description,video_url) VALUES ('ls-1','tp-1','course-1','Lesson 1','',null),('ls-2','tp-1','course-1','Lesson 2','Body text','https://example.test/v'),('ls-3','tp-1',null,'Lesson 3',' ',null)`);
    await x(`INSERT INTO lesson_segments (id,lesson_id,title,duration,sort_order) VALUES ('sg-1','ls-1','Seg','05:30',1)`);
    await x(`INSERT INTO assignments (id,course_id,lesson_id,created_by,type,title,due_date,points,instructions,time_limit,open_at,close_at) VALUES
      ('as-1','course-1','ls-1',$1,'quiz','Quiz 1','2026-12-31',10,'Do it',30,'2026-10-07 12:30:00+07','2026-10-08 00:00:00+00'),
      ('as-2','course-1',null,$1,'file','File 1','2026-11-01',20,null,null,null,null)`, [U(1)]);
    await x(`INSERT INTO quiz_questions (id,assignment_id,question_text,question_type,options,correct_index,correct_indices,correct_answer,matching_pairs,explanation,points) VALUES
      ($1,'as-1','2+2?','multiple_choice','["1","2","3","4"]'::jsonb,3,null,null,null,'',1.5),
      ($2,'as-1','Pick','multiple_choice','["a","b"]'::jsonb,null,'[0,1]'::jsonb,null,null,'Because',2),
      ($3,'as-1','Match','matching','[]'::jsonb,null,null,null,'[{"left":"a","right":"b"}]'::jsonb,'',1),
      ($4,'as-1','Fill','fill_blank','[]'::jsonb,null,null,'x',null,'',1)`, [U(40), U(41), U(42), U(43)]);
    await x(`INSERT INTO submissions (id,assignment_id,student_id,type,score,previous_score,question_scores,answers,is_manually_graded,submitted_at) VALUES
      ($1,'as-1',$2,'quiz',7.5,5,'{"q1":1.5}'::jsonb,'{"q1":3}'::jsonb,false,'2026-10-07 05:30:00+00'),
      ($3,'as-2',$2,'file',null,null,null,null,false,'2026-10-07 12:30:00+07')`, [U(50), U(2), U(51)]);
    await x(`INSERT INTO meetings (id,created_by,subject,join_url,start_datetime,end_datetime,passcode) VALUES ('mt-1',$1,'Sync','https://example.test/m','2026-10-07 09:00+07','2026-10-07 10:00+07','pw')`, [U(1)]);
    await x(`INSERT INTO teacher_private_lesson_availability (teacher_id,weekday,is_available,start_time,end_time) VALUES ($1,1,true,'08:00','13:30'),($1,2,false,'09:00','20:00')`, [U(1)]);
    await x(`INSERT INTO student_lesson_completions (id,student_id,lesson_id) VALUES ($1,$2,'ls-1')`, [U(60), U(2)]);
    await x(`INSERT INTO live_classes (id,course_id,lesson_id,room_name,title,scheduled_at,host_id,is_active) VALUES ($1,'course-1','ls-1','room-a','Live',now(),$2,false)`, [U(70), U(1)]);
    await x(`INSERT INTO live_class_participants (id,live_class_id,user_id,joined_at,left_at,duration_seconds) VALUES ($1,$2,$3,now(),null,null)`, [U(80), U(70), U(2)]);
    await x(`INSERT INTO private_lesson_requests (id,student_id,teacher_id,course_id,requested_at,requested_slots,duration_minutes,message,status,live_class_id) VALUES
      ($1,$2,$3,'course-1','2026-10-10 10:00+07','["2026-10-10T10:00:00+07:00"]'::jsonb,30,'','pending',null)`, [U(90), U(2), U(1)]);
    await x(`INSERT INTO lesson_live_broadcasts (lesson_id,is_live,youtube_video_id,started_by) VALUES ('ls-1',false,'abc',$1)`, [U(1)]);

    if (args.has("anomalies")) {
      // Constraints that the source enforces cannot be violated, so drop a few to simulate legacy drift.
      await x("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
      await x("ALTER TABLE course_enrollments DROP CONSTRAINT IF EXISTS course_enrollments_course_id_student_id_key");
      await x("ALTER TABLE lesson_segments DROP CONSTRAINT IF EXISTS lesson_segments_lesson_id_fkey");
      await x("ALTER TABLE submissions ALTER COLUMN score TYPE NUMERIC");
      await x("ALTER TABLE quiz_questions ALTER COLUMN options TYPE JSONB");
      await x(`INSERT INTO users (id,email,password_hash,username,display_name,role) VALUES ('ABCDEF00-0000-4000-8000-000000000001','up@example.test','h','upper','Upper','owner')`);
      await x(`INSERT INTO course_enrollments (id,course_id,student_id,progress) VALUES ($1,'course-1',$2,10)`, [U(22), U(2)]); // duplicate (course,student)
      await x(`INSERT INTO lesson_segments (id,lesson_id,title) VALUES ('sg-orphan','ls-missing','Orphan')`);
      await x(`UPDATE submissions SET score = 1.23456 WHERE id = $1`, [U(50)]);
      await x(`UPDATE quiz_questions SET options = to_jsonb('["x","y"]'::text) WHERE id = $1`, [U(40)]); // string-encoded
      await x(`UPDATE quiz_questions SET options = to_jsonb(to_jsonb('["z"]'::text)::text) WHERE id = $1`, [U(41)]); // double-encoded
      await x(`UPDATE users SET display_name = repeat('x', 1001) WHERE id = $1`, [U(3)]); // > VARCHAR2(1000)
    }
    if (args.has("legacy-gaps")) {
      // Test-only reproduction of the approved production-era schema. Run only after a disposable schema reset:
      // four newer feature tables do not exist, and chapters/topics predate their two boolean columns.
      await x("ALTER TABLE chapters DROP COLUMN is_published, DROP COLUMN is_locked");
      await x("ALTER TABLE topics DROP COLUMN is_published, DROP COLUMN is_locked");
      await x("DROP TABLE course_announcements, teacher_private_lesson_availability, private_lesson_requests, lesson_live_broadcasts");
      await x(`UPDATE submissions SET score = 16.78333333333333 WHERE id = $1`, [U(50)]);
    }
    console.log(`seeded ${id.database}${args.has("anomalies") ? " (with anomalies)" : ""}`);
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
