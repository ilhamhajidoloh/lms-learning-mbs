-- @statement
CREATE TABLE signup_requests (
  id VARCHAR2(36) NOT NULL,
  email VARCHAR2(320) NOT NULL,
  password_hash VARCHAR2(255) NOT NULL,
  username VARCHAR2(255) NOT NULL,
  display_name VARCHAR2(1000) NOT NULL,
  requested_role VARCHAR2(20) NOT NULL,
  status VARCHAR2(20) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR2(36),
  CONSTRAINT pk_signup_requests PRIMARY KEY (id),
  CONSTRAINT ck_signup_requests__role CHECK (requested_role IN ('teacher', 'student')),
  CONSTRAINT ck_signup_requests__status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT fk_signup_requests__reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
)

-- @statement
CREATE INDEX ix_signup_requests__status_created ON signup_requests (status, created_at)
