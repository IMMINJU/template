-- 기준선: 예전 코드가 실행 중에 만들던 표 그대로 (이미 있는 개발 DB 도 그대로 이어 받는다)
-- Up Migration
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Down Migration
DROP TABLE settings;
