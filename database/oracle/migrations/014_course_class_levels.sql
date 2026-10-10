-- @statement
CREATE TABLE course_class_levels (
  course_id VARCHAR2(255) NOT NULL,
  level_value VARCHAR2(255) NOT NULL,
  CONSTRAINT pk_course_class_levels PRIMARY KEY (course_id, level_value),
  CONSTRAINT fk_course_class_levels_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
)
