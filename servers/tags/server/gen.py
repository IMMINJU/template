"""pnpm gen: contract/proto → gen/ (gRPC 코드), 앱 라우트 → contract/openapi/tags.json

`python -m server.gen proto` 는 gRPC 코드만 (dev · test 전에)
"""

import importlib
import json
import sys
from importlib.resources import files
from pathlib import Path

from grpc_tools import protoc

ROOT = Path(__file__).resolve().parents[1]
PROTO = (ROOT / '../../contract/proto').resolve()


def proto() -> None:
    out = ROOT / 'gen'
    out.mkdir(exist_ok=True)
    sources = [str(p.relative_to(PROTO)) for p in sorted(PROTO.rglob('*.proto'))]
    args = [f'-I{PROTO}', f'-I{files("grpc_tools") / "_proto"}']
    # 메시지 · 서비스 타입 스텁은 mypy-protobuf (grpc 기본 생성 코드에는 타입이 없다)
    args += [f'--python_out={out}', f'--grpc_python_out={out}']
    args += [f'--mypy_out={out}', f'--mypy_grpc_out={out}']
    if protoc.main(['protoc', *args, *sources]) != 0:
        sys.exit('proto 생성 실패')
    # openapi() 가 같은 프로세스에서 바로 import 한다. 처음(gen/ 이 없을 때)에는 import 경로 캐시가 "없는 폴더"로 기억하고 있다
    importlib.invalidate_caches()


def openapi() -> None:
    from server.main import app

    doc = json.dumps(app.openapi(), indent=2, ensure_ascii=False, sort_keys=True)
    (ROOT / '../../contract/openapi/tags.json').write_text(doc + '\n')


if __name__ == '__main__':
    proto()
    if sys.argv[1:] != ['proto']:
        openapi()
