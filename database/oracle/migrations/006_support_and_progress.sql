-- @statement
CREATE TABLE meetings (
  id VARCHAR2(255) NOT NULL,
  created_by VARCHAR2(36) NOT NULL,
  subject VARCHAR2(2000) NOT NULL,
  join_url VARCHAR2(2048) NOT NULL,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  passcode VARCHAR2(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_meetings PRIMARY KEY (id),
  CONSTRAINT fk_meetings__users FOREIGN KEY (created_by) REFERENCES users (id)
)

-- @statement
CREATE TABLE teacher_private_lesson_availability (
  teacher_id VARCHAR2(36) NOT NULL,
  weekday NUMBER(10,0) NOT NULL,
  is_available NUMBER(1) DEFAULT 0 NOT NULL,
  start_time VARCHAR2(5) DEFAULT '08:00' NOT NULL,
  end_time VARCHAR2(5) DEFAULT '20:00' NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_teacher_availability PRIMARY KEY (teacher_id, weekday),
  CONSTRAINT fk_availability__users FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_availability__weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT ck_availability__available CHECK (is_available IN (0, 1)),
  CONSTRAINT ck_availability__start_time CHECK (REGEXP_LIKE(start_time, '^([01][0-9]|2[0-3]):[0-5][0-9]$')),
  CONSTRAINT ck_availability__end_time CHECK (REGEXP_LIKE(end_time, '^([01][0-9]|2[0-3]):[0-5][0-9]$')),
  CONSTRAINT ck_availability__time_order CHECK (start_time < end_time)
)

-- @statement
CREATE TABLE student_lesson_completions (
  id VARCHAR2(36) NOT NULL,
  student_id VARCHAR2(36) NOT NULL,
  lesson_id VARCHAR2(255) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_lesson_completions PRIMARY KEY (id),
  CONSTRAINT fk_completions__users FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_completions__lessons FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT uq_completions__student_lesson UNIQUE (student_id, lesson_id)
)
