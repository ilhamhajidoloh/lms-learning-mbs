-- @statement
CREATE TABLE users (
  id VARCHAR2(36) NOT NULL,
  email VARCHAR2(320) NOT NULL,
  password_hash VARCHAR2(255) NOT NULL,
  username VARCHAR2(255) NOT NULL,
  display_name VARCHAR2(1000) NOT NULL,
  role VARCHAR2(20) DEFAULT 'student' NOT NULL,
  password_changed NUMBER(1) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users__email UNIQUE (email),
  CONSTRAINT uq_users__username UNIQUE (username),
  CONSTRAINT ck_users__role CHECK (role IN ('admin', 'teacher', 'student')),
  CONSTRAINT ck_users__password_changed CHECK (password_changed IN (0, 1))
)
