-- @statement
CREATE TABLE quiz_questions (
  id VARCHAR2(36) NOT NULL,
  assignment_id VARCHAR2(255) NOT NULL,
  question_text CLOB NOT NULL,
  question_type VARCHAR2(30) DEFAULT 'multiple_choice' NOT NULL,
  options CLOB DEFAULT '[]' NOT NULL,
  correct_index NUMBER(10,0),
  correct_indices CLOB,
  correct_answer CLOB,
  matching_pairs CLOB,
  explanation CLOB DEFAULT EMPTY_CLOB() NOT NULL,
  points NUMBER(12,4) DEFAULT 1 NOT NULL,
  is_required NUMBER(1) DEFAULT 1 NOT NULL,
  sort_order NUMBER(10,0) DEFAULT 0 NOT NULL,
  CONSTRAINT pk_quiz_questions PRIMARY KEY (id),
  CONSTRAINT fk_questions__assignments FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT ck_questions__type CHECK (question_type IN ('multiple_choice', 'fill_blank', 'matching', 'essay')),
  CONSTRAINT ck_questions__correct_index CHECK (correct_index >= 0),
  CONSTRAINT ck_questions__options_json CHECK (options IS JSON),
  CONSTRAINT ck_questions__indices_json CHECK (correct_indices IS JSON),
  CONSTRAINT ck_questions__pairs_json CHECK (matching_pairs IS JSON),
  CONSTRAINT ck_questions__required CHECK (is_required IN (0, 1))
)

-- @statement
CREATE TABLE submissions (
  id VARCHAR2(36) NOT NULL,
  assignment_id VARCHAR2(255) NOT NULL,
  student_id VARCHAR2(36) NOT NULL,
  submission_type VARCHAR2(20) NOT NULL,
  file_name VARCHAR2(2000),
  file_path VARCHAR2(4000),
  score NUMBER(12,4),
  previous_score NUMBER(12,4),
  question_scores CLOB,
  answers CLOB,
  is_manually_graded NUMBER(1) DEFAULT 0 NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_submissions PRIMARY KEY (id),
  CONSTRAINT fk_submissions__assignments FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions__users FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_submissions__type CHECK (submission_type IN ('file', 'quiz')),
  CONSTRAINT ck_submissions__score CHECK (score >= 0),
  CONSTRAINT ck_submissions__prev_score CHECK (previous_score >= 0),
  CONSTRAINT ck_submissions__scores_json CHECK (question_scores IS JSON),
  CONSTRAINT ck_submissions__answers_json CHECK (answers IS JSON),
  CONSTRAINT ck_submissions__manual CHECK (is_manually_graded IN (0, 1))
)
