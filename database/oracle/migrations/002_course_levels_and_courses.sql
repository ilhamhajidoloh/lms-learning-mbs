-- @statement
CREATE TABLE course_levels (
  id VARCHAR2(36) NOT NULL,
  level_value VARCHAR2(255) NOT NULL,
  label VARCHAR2(1000) NOT NULL,
  sort_order NUMBER(10,0) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_course_levels PRIMARY KEY (id),
  CONSTRAINT uq_course_levels__value UNIQUE (level_value)
)

-- @statement
CREATE TABLE courses (
  id VARCHAR2(255) NOT NULL,
  title VARCHAR2(2000) NOT NULL,
  course_level VARCHAR2(255) NOT NULL,
  level_label VARCHAR2(1000) NOT NULL,
  gradient_class VARCHAR2(255) DEFAULT 'from-indigo-500 to-purple-600' NOT NULL,
  instructor_id VARCHAR2(36) NOT NULL,
  is_open NUMBER(1) DEFAULT 0 NOT NULL,
  enroll_code VARCHAR2(255),
  show_scores NUMBER(1) DEFAULT 1 NOT NULL,
  sequential_lessons NUMBER(1) DEFAULT 0 NOT NULL,
  quiz_review_mode VARCHAR2(30) DEFAULT 'full' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_courses PRIMARY KEY (id),
  CONSTRAINT fk_courses__users FOREIGN KEY (instructor_id) REFERENCES users (id),
  CONSTRAINT ck_courses__is_open CHECK (is_open IN (0, 1)),
  CONSTRAINT ck_courses__show_scores CHECK (show_scores IN (0, 1)),
  CONSTRAINT ck_courses__sequential CHECK (sequential_lessons IN (0, 1))
)
