-- @statement
CREATE TABLE lesson_live_broadcasts (
  lesson_id VARCHAR2(255) NOT NULL,
  is_live NUMBER(1) DEFAULT 0 NOT NULL,
  youtube_video_id VARCHAR2(255),
  started_by VARCHAR2(36),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_lesson_live_broadcasts PRIMARY KEY (lesson_id),
  CONSTRAINT fk_broadcasts__lessons FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_broadcasts__users FOREIGN KEY (started_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT ck_broadcasts__live CHECK (is_live IN (0, 1))
)
