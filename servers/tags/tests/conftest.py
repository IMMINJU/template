"""모든 API 테스트의 공통 설정: 실제 HTTP · gRPC 서버를 랜덤 포트로 띄우고(뜰 때 마이그레이션), 테스트 DB(tags_test,
docker 의 Postgres)를 테스트 앞뒤로 비운다. Fake 가 생기면 여기서 교체 지점에 등록하고 테스트 전후로 reset 한다"""

import os

os.environ['PGDATABASE'] = 'tags_test'
os.environ['GRPC_PORT'] = '0'

import threading
import time

import grpc
import httpx
import pytest
import uvicorn
from psycopg import sql
from psycopg_pool import PoolTimeout

from server.main import app
from server.storage.db import db


@pytest.fixture(scope='session')
def database():
    try:
        db().wait(timeout=5)
    except PoolTimeout:
        pytest.exit(
            'Postgres 에 붙지 못했다. 저장소 루트에서 pnpm infra 를 먼저 돌린다', returncode=1
        )


@pytest.fixture(scope='session')
def server(database):
    s = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=0, log_level='warning'))
    t = threading.Thread(target=s.run, daemon=True)
    t.start()
    deadline = time.monotonic() + 10
    while not s.started:
        assert time.monotonic() < deadline, '서버가 10초 안에 뜨지 않았다'
        time.sleep(0.01)
    yield s.servers[0].sockets[0].getsockname()[1]
    s.should_exit = True
    t.join()


@pytest.fixture
def client(server):
    """실제 HTTP 요청"""
    with httpx.Client(base_url=f'http://127.0.0.1:{server}') as c:
        yield c


@pytest.fixture
def channel(server):
    """실제 gRPC 연결 (다른 서버가 부르는 것과 같은 프로토콜)"""
    with grpc.insecure_channel(f'127.0.0.1:{app.state.grpc_port}') as ch:
        yield ch


@pytest.fixture(autouse=True)
def clean_db(database):
    def clean():
        with db().connection() as c:
            # 마이그레이션 기록(alembic_version)은 남긴다. TRUNCATE 는 id(IDENTITY)를 되돌리지 않는다
            tables = c.execute(
                'SELECT tablename FROM pg_tables'
                " WHERE schemaname = current_schema() AND tablename <> 'alembic_version'"
            ).fetchall()
            if tables:
                names = sql.SQL(', ').join(sql.Identifier(name) for (name,) in tables)
                c.execute(sql.SQL('TRUNCATE {}').format(names))

    clean()
    yield
    clean()
