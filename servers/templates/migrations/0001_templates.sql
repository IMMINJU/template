-- 템플릿 표. 예시 하나를 같이 넣는다 (tags 의 예시 규칙이 회의 · 할 일 에 태그를 매긴다)
-- +goose Up
CREATE TABLE templates (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name TEXT NOT NULL, body TEXT NOT NULL);
INSERT INTO templates (name, body) VALUES ('회의록', E'회의\n할 일');

-- +goose Down
DROP TABLE templates;
