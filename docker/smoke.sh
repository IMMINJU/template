#!/bin/sh
# 전체 스택(pnpm stack)이 뜬 뒤 실제 이미지 · 네트워크 · DB 로 확인한다. 서버 · 앱마다 한 덩어리 (pnpm drop 이 덩어리째 지운다)
set -eu
get() { curl -fsS --retry 60 --retry-delay 1 --retry-all-errors "$1"; }
post() { curl -fsS -X POST -H 'content-type: application/json' -d "$2" "$1"; }
id() { sed 's/.*"id": *\([0-9]*\).*/\1/'; }
gone() { test "$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$1")" = 204; }

# tags: 규칙을 하나 만든다 (끝에 지운다)
rules="http://127.0.0.1:${TAGS_PORT:-8002}/api/tags/rules"
get "$rules" >/dev/null
rule=$(post "$rules" '{"keyword":"smoke","tag":"스모크"}' | id)
echo "ok $rules"

# activity
activity="http://127.0.0.1:${ACTIVITY_PORT:-8001}/api/activity"
get "$activity" >/dev/null
echo "ok $activity"

# notes: 저장 전에 tags 에 태그를 묻고, 저장 뒤 activity 에 남긴다 (끝에 지운다)
notes="http://127.0.0.1:${NOTES_PORT:-8000}/api/notes"
get "$notes" >/dev/null
note=$(post "$notes" '{"text":"smoke"}')
echo "$note" | grep -q '"스모크"'
id=$(echo "$note" | id)
get "$activity" | grep -Eq "\"noteId\": ?$id[,}]"
echo "ok $notes → tags · activity (gRPC)"

# templates: 템플릿을 하나 만든다 (끝에 지운다. 예시 템플릿은 사용자가 고칠 수 있어 기대지 않는다)
templates="http://127.0.0.1:${TEMPLATES_PORT:-8003}/api/templates"
get "$templates" >/dev/null
template=$(post "$templates" '{"name":"smoke","body":"스모크"}' | id)
echo "ok $templates"

# web: 화면과 같은 출처 /api/notes · /api/templates, 표에 없는 /api 는 JSON 404
get "http://127.0.0.1:${WEB_PORT:-5280}/" | grep -q '<html'
get "http://127.0.0.1:${WEB_PORT:-5280}/api/notes" | grep -q '"smoke"'
get "http://127.0.0.1:${WEB_PORT:-5280}/api/templates" | grep -q '"smoke"'
test "$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${WEB_PORT:-5280}/api/unknown")" = 404
echo "ok web"

# admin: /api/tags · /api/activity · /api/templates 를 각 서버로
get "http://127.0.0.1:${ADMIN_PORT:-5281}/" | grep -q '<html'
get "http://127.0.0.1:${ADMIN_PORT:-5281}/api/tags/rules" | grep -q '"rules"'
get "http://127.0.0.1:${ADMIN_PORT:-5281}/api/activity" | grep -q '"activities"'
get "http://127.0.0.1:${ADMIN_PORT:-5281}/api/templates" | grep -q '"smoke"'
echo "ok admin"

# site: 서버에서 미리 받아 HTML 에 담는다
get "http://127.0.0.1:${SITE_PORT:-5282}/" | grep -q 'smoke'
echo "ok site"

# lite: 화면과 같은 출처 /api/notes
get "http://127.0.0.1:${LITE_PORT:-5283}/" | grep -q '<html'
get "http://127.0.0.1:${LITE_PORT:-5283}/api/notes" | grep -q '"smoke"'
echo "ok lite"

# 만든 것을 지운다 (204 No Content)
gone "$notes/$id"
gone "$rules/$rule"
gone "$templates/$template"
echo "ok 지우기"
