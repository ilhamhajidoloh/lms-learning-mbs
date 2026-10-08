-- @statement
CREATE TABLE chapters (
  id VARCHAR2(255) NOT NULL,
  course_id VARCHAR2(255) NOT NULL,
  title VARCHAR2(2000) NOT NULL,
  sort_order NUMBER(10,0) DEFAULT 0 NOT NULL,
  is_published NUMBER(1) DEFAULT 1 NOT NULL,
  is_locked NUMBER(1) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_chapters PRIMARY KEY (id),
  CONSTRAINT fk_chapters__courses FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT ck_chapters__published CHECK (is_published IN (0, 1)),
  CONSTRAINT ck_chapters__locked CHECK (is_locked IN (0, 1))
)

-- @statement
CREATE TABLE topics (
  id VARCHAR2(255) NOT NULL,
  chapter_id VARCHAR2(255) NOT NULL,
  title VARCHAR2(2000) NOT NULL,
  sort_order NUMBER(10,0) DEFAULT 0 NOT NULL,
  is_published NUMBER(1) DEFAULT 1 NOT NULL,
  is_locked NUMBER(1) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_topics PRIMARY KEY (id),
  CONSTRAINT fk_topics__chapters FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE,
  CONSTRAINT ck_topics__published CHECK (is_published IN (0, 1)),
  CONSTRAINT ck_topics__locked CHECK (is_locked IN (0, 1))
)

-- @statement
CREATE TABLE lessons (
  id VARCHAR2(255) NOT NULL,
  topic_id VARCHAR2(255) NOT NULL,
  course_id VARCHAR2(255),
  title VARCHAR2(2000) NOT NULL,
  description CLOB DEFAULT EMPTY_CLOB() NOT NULL,
  video_url VARCHAR2(2048),
  sort_order NUMBER(10,0) DEFAULT 0 NOT NULL,
  is_published NUMBER(1) DEFAULT 1 NOT NULL,
  is_locked NUMBER(1) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_lessons PRIMARY KEY (id),
  CONSTRAINT fk_lessons__topics FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE,
  CONSTRAINT fk_lessons__courses FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT ck_lessons__published CHECK (is_published IN (0, 1)),
  CONSTRAINT ck_lessons__locked CHECK (is_locked IN (0, 1))
)

-- @statement
CREATE TABLE lesson_segments (
  id VARCHAR2(255) NOT NULL,
  lesson_id VARCHAR2(255) NOT NULL,
  title VARCHAR2(2000) NOT NULL,
  duration VARCHAR2(20) DEFAULT '00:00' NOT NULL,
  sort_order NUMBER(10,0) DEFAULT 0 NOT NULL,
  CONSTRAINT pk_lesson_segments PRIMARY KEY (id),
  CONSTRAINT fk_segments__lessons FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
)
