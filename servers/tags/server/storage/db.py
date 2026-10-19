import os
import threading
from pathlib import Path

from alembic import command
from alembic.config import Config
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None
# HTTP · gRPC 스레드풀이 처음에 동시에 불러도 풀은 하나만
_lock = threading.Lock()


def conninfo() -> dict[str, str]:
    """PG* 환경 변수, 기본은 docker/docker-compose.middleware.yaml 의 Postgres. 마이그레이션(migrations/env.py)도 쓴다"""
    env = os.environ.get
    return {
        'host': env('PGHOST', '127.0.0.1'),
        'port': env('PGPORT', '5432'),
        'dbname': env('PGDATABASE', 'tags'),
        'user': env('PGUSER', 'app'),
        'password': env('PGPASSWORD', 'app'),
    }


def migrate() -> None:
    """migrations/ 를 끝까지 적용한다 (alembic upgrade head). 서버가 뜰 때 lifespan 에서, 요청을 받기 전에"""
    command.upgrade(Config(toml_file=Path(__file__).parents[2] / 'pyproject.toml'), 'head')


def db() -> ConnectionPool:
    """처음 부를 때 연다 (PG* 환경 변수도 이때 읽는다). 테이블은 migrations/ 가 만든다"""
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:
                _pool = ConnectionPool(kwargs=conninfo(), open=True)
    return _pool


def close() -> None:
    global _pool
    with _lock:
        if _pool is not None:
            _pool.close()
            _pool = None
