-- 메모 하나(settings 의 note) → 메모 목록
-- Up Migration
CREATE TABLE notes (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, text TEXT NOT NULL);
INSERT INTO notes (text) SELECT value FROM settings WHERE key = 'note' AND value <> '';
DROP TABLE settings;

-- Down Migration
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO settings SELECT 'note', text FROM notes ORDER BY id LIMIT 1;
DROP TABLE notes;
