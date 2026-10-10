-- @statement
ALTER TABLE course_enrollments ADD (group_name VARCHAR2(255))

-- @statement
ALTER TABLE lessons ADD (target_group VARCHAR2(255))

-- @statement
ALTER TABLE assignments ADD (target_group VARCHAR2(255))
