-- 메모마다 태그 (저장할 때 tags 서버가 매긴다)
-- Up Migration
ALTER TABLE notes ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

-- Down Migration
ALTER TABLE notes DROP COLUMN tags;
