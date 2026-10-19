"""alembic 이 마이그레이션을 돌리는 곳. SQLAlchemy 는 여기서 연결에만 쓴다 (앱은 psycopg)"""

from alembic import context
from sqlalchemy import create_engine, pool

from server.storage.db import conninfo

# 주소는 비우고 앱과 같은 PG* 환경 변수 · 기본값을 psycopg 연결 인자로 넘긴다
engine = create_engine('postgresql+psycopg://', connect_args=conninfo(), poolclass=pool.NullPool)
with engine.connect() as connection:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()
