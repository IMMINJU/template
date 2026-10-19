-- 스키마 변경은 새 V{n}__*.sql 로 (적용된 파일은 고치지 않는다)
CREATE TABLE activity (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action TEXT NOT NULL,
  note_id BIGINT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
