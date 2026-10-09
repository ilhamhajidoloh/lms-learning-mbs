-- @statement
ALTER TABLE courses ADD (
  description CLOB DEFAULT EMPTY_CLOB() NOT NULL
)
