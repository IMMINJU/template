-- 서버마다 자기 DB 와 테스트 DB(<서버>_test, 테스트가 비운다). 서버를 더하면 두 줄 더하고
-- 이미 만든 볼륨에는 다시 돌지 않으니 그 두 줄만 직접 실행한다 (docker compose exec db psql -U app -c 'CREATE DATABASE ...')
CREATE DATABASE notes;
CREATE DATABASE notes_test;
CREATE DATABASE tags;
CREATE DATABASE tags_test;
CREATE DATABASE activity;
CREATE DATABASE activity_test;
CREATE DATABASE templates;
CREATE DATABASE templates_test;
