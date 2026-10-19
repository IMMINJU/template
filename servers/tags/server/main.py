import os
import re
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import grpc
from fastapi import FastAPI

from server.api.routes import rules
from server.api.rpc import tags
from server.storage import db
from server.support import errors, security


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 스키마를 먼저 맞춘다 (요청을 받기 전에). openapi 내보내기(server.gen)는 lifespan 을 돌리지 않아 DB 가 없어도 된다
    db.migrate()
    # 서버 간 통신: contract/proto 의 서비스를 gRPC 로 연다. HTTP 와 같은 HOST 에.
    # DB 드라이버가 동기라 HTTP 핸들러처럼 스레드풀에서 돈다
    server = grpc.server(ThreadPoolExecutor())
    tags.add(server)
    host = os.environ.get('HOST', '127.0.0.1')
    app.state.grpc_port = server.add_insecure_port(f'{host}:{os.environ.get("GRPC_PORT", "9002")}')
    server.start()
    yield
    server.stop(0)
    db.close()


# operationId = 함수 이름의 camelCase (list_rules → listRules, 다른 서버와 같게). 이 서버 안에서 유일하게
app = FastAPI(
    title='tags',
    version='0.0.0',
    lifespan=lifespan,
    generate_unique_id_function=lambda r: re.sub(r'_([a-z])', lambda m: m[1].upper(), r.name),
)
app.include_router(rules.router)
security.install(app)
errors.install(app)
