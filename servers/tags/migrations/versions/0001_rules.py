"""태그 규칙: keyword 가 메모에 들어 있으면 tag. 예시 규칙을 같이 넣는다"""

from alembic import op

revision = '0001'
down_revision = None


def upgrade() -> None:
    op.execute(
        'CREATE TABLE rules (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,'
        ' keyword TEXT NOT NULL, tag TEXT NOT NULL)'
    )
    op.execute(
        'INSERT INTO rules (keyword, tag) VALUES'
        " ('회의', '회의'), ('할 일', '할일'), ('todo', '할일'), ('버그', '버그')"
    )
