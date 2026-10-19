#!/usr/bin/env python3
"""Claude Code PreToolUse: 이 저장소 규칙을 어기는 편집을 막는다 (AGENTS.md). 규칙을 바꾸면 check-patterns.test.sh"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

GENERATED = re.compile(r'^(contract/openapi/[^/]+\.(json|ts)|contract/gen/.+|servers/tags/gen/.+)$')
MIGRATION = re.compile(r'^servers/activity/storage/db-core/src/main/resources/db/migration/V[^/]+\.sql$')
CLIENT_SOURCE = re.compile(r'^clients/apps/[^/]+/(src|app)/.+\.(tsx?|vue)$')
RAW_HTML = re.compile(r'\binnerHTML\b|\bv-html\b|\bdangerouslySetInnerHTML\b')
SPRING_TEST = re.compile(r'^servers/activity/.+/src/test/.+\.java$')
MOCKED_CLIENT = re.compile(r'@MockitoBean\b[^\n]*(?:\n[^\n]*)?\b\w+Client\b')
NODE_TEST = re.compile(r'^servers/notes/tests/.+\.ts$')
MOCKED_MODULE = re.compile(r'\bmock\.module\(')
FASTAPI_TEST = re.compile(r'^servers/tags/tests/.+\.py$')
PATCHED_CLIENT = re.compile(r'\bpatch(?:\.object)?\(\s*[\'"]server\.clients\b')
GO_TEST = re.compile(r'^servers/[^/]+/.+_test\.go$')
GO_MOCK = re.compile(r'\bgomock\b|testify/mock\b|\bmockery\b')


def deny(reason):
    print(
        json.dumps(
            {
                'hookSpecificOutput': {
                    'hookEventName': 'PreToolUse',
                    'permissionDecision': 'deny',
                    'permissionDecisionReason': reason,
                }
            },
            ensure_ascii=False,
        )
    )
    sys.exit(0)


def git(cwd, *args):
    return subprocess.run(['git', '-C', str(cwd), *args], capture_output=True, text=True)


def project_root(path):
    if os.environ.get('CLAUDE_PROJECT_DIR'):
        return Path(os.environ['CLAUDE_PROJECT_DIR']).resolve()
    existing = next(p for p in [path, *path.parents] if p.is_dir())
    top = git(existing, 'rev-parse', '--show-toplevel').stdout.strip()
    return Path(top) if top else None


def main():
    tool_input = json.load(sys.stdin).get('tool_input', {})
    file_path = tool_input.get('file_path')
    if not file_path:
        return
    path = Path(file_path).resolve()
    root = project_root(path)
    if root is None or not path.is_relative_to(root):
        return
    rel = path.relative_to(root).as_posix()
    text = '\n'.join(
        [tool_input.get('content') or '', tool_input.get('new_string') or '']
        + [edit.get('new_string') or '' for edit in tool_input.get('edits') or []]
    )

    if GENERATED.match(rel):
        deny('생성된 파일은 직접 고치지 않는다. 서버 코드 · proto 를 고치고 pnpm gen 으로 다시 만든다 (ADR-0001 · 0002).')
    # origin 이 없거나 아직 push 하지 않은 로컬 main 도 본다
    if MIGRATION.match(rel) and any(
        git(root, 'cat-file', '-e', f'{ref}:{rel}').returncode == 0 for ref in ('main', 'origin/main')
    ):
        deny('main 에 들어간 마이그레이션은 고치지 않는다. 새 V{n}__*.sql 을 만든다 (servers/activity/AGENTS.md).')
    if CLIENT_SOURCE.match(rel) and RAW_HTML.search(text):
        deny('API 응답 문자열을 HTML 로 넣지 않는다 (innerHTML · v-html · dangerouslySetInnerHTML 금지). 텍스트로 렌더한다.')
    if SPRING_TEST.match(rel) and MOCKED_CLIENT.search(text):
        deny('외부 클라이언트는 @MockitoBean 대신 Fake 를 @Primary Bean 으로 넣는다 (ADR-0003).')
    if NODE_TEST.match(rel) and MOCKED_MODULE.search(text):
        deny('모듈을 mock.module 로 바꾸지 않는다. clients/ 의 교체 지점(useX(fake))에 Fake 를 넣는다 (ADR-0003).')
    if FASTAPI_TEST.match(rel) and PATCHED_CLIENT.search(text):
        deny('외부 클라이언트를 patch 하지 않는다. app.dependency_overrides 나 교체 지점으로 Fake 를 넣는다 (ADR-0003).')
    if GO_TEST.match(rel) and GO_MOCK.search(text):
        deny('Go 테스트에 mock 라이브러리(gomock · testify/mock · mockery)를 쓰지 않는다. 교체 지점에 Fake 를 넣는다 (ADR-0003).')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        pass
