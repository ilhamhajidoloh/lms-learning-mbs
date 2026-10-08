-- @statement
CREATE TABLE live_classes (
  id VARCHAR2(36) NOT NULL,
  course_id VARCHAR2(255) NOT NULL,
  lesson_id VARCHAR2(255),
  room_name VARCHAR2(255) NOT NULL,
  title VARCHAR2(2000) NOT NULL,
  description CLOB,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  duration_minutes NUMBER(10,0) DEFAULT 60,
  host_id VARCHAR2(36) NOT NULL,
  is_active NUMBER(1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_live_classes PRIMARY KEY (id),
  CONSTRAINT uq_live_classes__room UNIQUE (room_name),
  CONSTRAINT fk_live_classes__courses FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_live_classes__lessons FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE SET NULL,
  CONSTRAINT fk_live_classes__users FOREIGN KEY (host_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_live_classes__active CHECK (is_active IN (0, 1))
)

-- @statement
CREATE TABLE live_class_participants (
  id VARCHAR2(36) NOT NULL,
  live_class_id VARCHAR2(36) NOT NULL,
  user_id VARCHAR2(36) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
  left_at TIMESTAMP WITH TIME ZONE,
  duration_seconds NUMBER(10,0),
  CONSTRAINT pk_live_class_participants PRIMARY KEY (id),
  CONSTRAINT fk_participants__live_classes FOREIGN KEY (live_class_id) REFERENCES live_classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_participants__users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT uq_participants__class_user UNIQUE (live_class_id, user_id)
)
