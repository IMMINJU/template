#!/usr/bin/env bash
# 저장소 루트에서: .claude/hooks/check-patterns.test.sh
set -u
root=$(cd "$(dirname "$0")/../.." && pwd)
hook="$root/.claude/hooks/check-patterns.py"
fail=0

check() { # 이름, 기대(deny|allow), 파일, 내용
  input=$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Edit","tool_input":{"file_path":sys.argv[1],"new_string":sys.argv[2]}}))' "$root/$3" "$4")
  out=$(printf '%s' "$input" | CLAUDE_PROJECT_DIR="$root" "$hook")
  if [[ "$out" == *'"deny"'* ]]; then got=deny; else got=allow; fi
  if [[ "$got" == "$2" ]]; then echo "ok   $1"; else echo "FAIL $1 (expected $2, got $got)"; fail=1; fi
}

check "생성된 openapi 문서" deny "contract/openapi/notes.json" '{}'
check "생성된 openapi 타입" deny "contract/openapi/activity.ts" 'export interface paths {}'
check "생성된 proto TS" deny "contract/gen/app/tag/v1/tag_pb.js" 'x'
check "생성된 proto Python" deny "servers/tags/gen/app/tag/v1/tag_pb2.py" 'x'
check "contract 네임스페이스" allow "contract/index.ts" "export type * as go from './openapi/go.ts'"
check "proto 원본" allow "contract/proto/app/tag/v1/tag.proto" 'string text = 1;'
check "새 마이그레이션" allow "servers/activity/storage/db-core/src/main/resources/db/migration/V2__activity_actor.sql" 'CREATE TABLE tag (id INT);'
check "web innerHTML" deny "clients/apps/lite/src/main.ts" 'note.innerHTML = text'
check "vue v-html" deny "clients/apps/admin/src/App.vue" '<p v-html="data.text" />'
check "next dangerouslySetInnerHTML" deny "clients/apps/site/app/notes.tsx" '<p dangerouslySetInnerHTML={{ __html: t }} />'
check "textContent" allow "clients/apps/lite/src/main.ts" 'err.textContent = message'
check "spring MockitoBean 클라이언트" deny "servers/activity/core/core-api/src/test/java/app/X.java" $'@MockitoBean\nMailClient mail;'
check "go gomock" deny "servers/templates/tests/templates/GET_specs_test.go" 'ctrl := gomock.NewController(t)'
check "go testify mock" deny "servers/templates/tests/support/fakes_test.go" 'import "github.com/stretchr/testify/mock"'
check "go Fake" allow "servers/templates/tests/templates/GET_specs_test.go" 'fake := &FakeMailer{}'
check "spring Fake 주입" allow "servers/activity/core/core-api/src/test/java/app/X.java" $'@Autowired\nFakeMailClient mail;'
check "node mock.module" deny "servers/notes/tests/notes/GET_specs.ts" "mock.module('../../src/clients/mail.ts', {})"
check "node Fake 교체" allow "servers/notes/tests/support/api.ts" 'useMailer(fakeMailer)'
check "python patch 클라이언트" deny "servers/tags/tests/tags/rules/POST_specs.py" "with patch('server.clients.mail.send'):"
check "python dependency_overrides" allow "servers/tags/tests/conftest.py" 'app.dependency_overrides[get_mailer] = lambda: fake'
exit $fail
