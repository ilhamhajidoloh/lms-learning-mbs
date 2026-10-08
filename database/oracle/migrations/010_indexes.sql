-- @statement
CREATE INDEX ix_courses__instructor_created ON courses (instructor_id, created_at DESC)

-- @statement
CREATE INDEX ix_enrollments__student ON course_enrollments (student_id)

-- @statement
CREATE INDEX ix_announcements__course_created ON course_announcements (course_id, created_at DESC)

-- @statement
CREATE INDEX ix_announcements__author ON course_announcements (author_id)

-- @statement
CREATE INDEX ix_chapters__course_sort ON chapters (course_id, sort_order)

-- @statement
CREATE INDEX ix_topics__chapter_sort ON topics (chapter_id, sort_order)

-- @statement
CREATE INDEX ix_lessons__topic_sort ON lessons (topic_id, sort_order)

-- @statement
CREATE INDEX ix_lessons__course ON lessons (course_id)

-- @statement
CREATE INDEX ix_segments__lesson_sort ON lesson_segments (lesson_id, sort_order)

-- @statement
CREATE INDEX ix_assignments__course ON assignments (course_id)

-- @statement
CREATE INDEX ix_assignments__lesson ON assignments (lesson_id)

-- @statement
CREATE INDEX ix_assignments__creator ON assignments (created_by)

-- @statement
CREATE INDEX ix_questions__assignment_sort ON quiz_questions (assignment_id, sort_order)

-- @statement
CREATE INDEX ix_submissions__assignment ON submissions (assignment_id)

-- @statement
CREATE INDEX ix_submissions__student_time ON submissions (student_id, submitted_at DESC)

-- @statement
CREATE INDEX ix_meetings__creator ON meetings (created_by)

-- @statement
CREATE INDEX ix_meetings__start_time ON meetings (start_datetime DESC)

-- @statement
CREATE INDEX ix_completions__lesson ON student_lesson_completions (lesson_id)

-- @statement
CREATE INDEX ix_live_classes__active_course ON live_classes (is_active, course_id)

-- @statement
CREATE INDEX ix_live_classes__lesson ON live_classes (lesson_id)

-- @statement
CREATE INDEX ix_live_classes__host ON live_classes (host_id)

-- @statement
CREATE INDEX ix_live_classes__scheduled ON live_classes (scheduled_at)

-- @statement
CREATE INDEX ix_participants__user ON live_class_participants (user_id)

-- @statement
CREATE INDEX ix_requests__student_created ON private_lesson_requests (student_id, created_at DESC)

-- @statement
CREATE INDEX ix_requests__teacher_status ON private_lesson_requests (teacher_id, status, requested_at)

-- @statement
CREATE INDEX ix_requests__course ON private_lesson_requests (course_id)

-- @statement
CREATE INDEX ix_requests__live_class ON private_lesson_requests (live_class_id)

-- @statement
CREATE INDEX ix_broadcasts__started_by ON lesson_live_broadcasts (started_by)
