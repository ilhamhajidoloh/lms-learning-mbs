-- @statement
CREATE TABLE course_enrollments (
  id VARCHAR2(36) NOT NULL,
  course_id VARCHAR2(255) NOT NULL,
  student_id VARCHAR2(36) NOT NULL,
  progress NUMBER(10,0) DEFAULT 0 NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_course_enrollments PRIMARY KEY (id),
  CONSTRAINT fk_enroll__courses FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll__users FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT uq_enroll__course_student UNIQUE (course_id, student_id),
  CONSTRAINT ck_enroll__progress CHECK (progress BETWEEN 0 AND 100)
)

-- @statement
CREATE TABLE course_announcements (
  id VARCHAR2(36) NOT NULL,
  course_id VARCHAR2(255) NOT NULL,
  author_id VARCHAR2(36) NOT NULL,
  title VARCHAR2(2000) NOT NULL,
  body CLOB DEFAULT EMPTY_CLOB() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_course_announcements PRIMARY KEY (id),
  CONSTRAINT fk_announcements__courses FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_announcements__users FOREIGN KEY (author_id) REFERENCES users (id)
)

-- @statement
CREATE TABLE assignments (
  id VARCHAR2(255) NOT NULL,
  course_id VARCHAR2(255) NOT NULL,
  lesson_id VARCHAR2(255),
  created_by VARCHAR2(36) NOT NULL,
  assignment_type VARCHAR2(20) NOT NULL,
  title VARCHAR2(2000) NOT NULL,
  due_date DATE NOT NULL,
  points NUMBER(12,4) DEFAULT 10 NOT NULL,
  instructions CLOB,
  time_limit NUMBER(10,0),
  show_scores NUMBER(1) DEFAULT 1 NOT NULL,
  quiz_review_mode VARCHAR2(30) DEFAULT 'full' NOT NULL,
  is_open NUMBER(1) DEFAULT 1 NOT NULL,
  allow_edit_submission NUMBER(1) DEFAULT 0 NOT NULL,
  allow_cancel_submission NUMBER(1) DEFAULT 0 NOT NULL,
  quiz_attempt_limit NUMBER(10,0),
  multi_select_scoring_mode VARCHAR2(30) DEFAULT 'correct_only' NOT NULL,
  open_at TIMESTAMP WITH TIME ZONE,
  close_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_assignments PRIMARY KEY (id),
  CONSTRAINT fk_assignments__courses FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments__lessons FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments__users FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT ck_assignments__type CHECK (assignment_type IN ('file', 'quiz')),
  CONSTRAINT ck_assignments__points CHECK (points > 0),
  CONSTRAINT ck_assignments__time_limit CHECK (time_limit > 0),
  CONSTRAINT ck_assignments__show_scores CHECK (show_scores IN (0, 1)),
  CONSTRAINT ck_assignments__is_open CHECK (is_open IN (0, 1)),
  CONSTRAINT ck_assignments__allow_edit CHECK (allow_edit_submission IN (0, 1)),
  CONSTRAINT ck_assignments__allow_cancel CHECK (allow_cancel_submission IN (0, 1))
)
