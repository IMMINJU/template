from dataclasses import dataclass
from typing import LiteralString

from psycopg.rows import class_row

from server.storage.db import db


@dataclass
class Rule:
    id: int
    keyword: str
    tag: str


def _rows(query: LiteralString, *params: object) -> list[Rule]:
    with db().connection() as c:
        return c.cursor(row_factory=class_row(Rule)).execute(query, params).fetchall()


def find_all() -> list[Rule]:
    """만든 순서(id)대로"""
    return _rows('SELECT id, keyword, tag FROM rules ORDER BY id')


def create(keyword: str, tag: str) -> Rule:
    return _rows(
        'INSERT INTO rules (keyword, tag) VALUES (%s, %s) RETURNING id, keyword, tag', keyword, tag
    )[0]


def delete(id: int) -> Rule | None:
    """지운 규칙, 없는 id 면 None"""
    rows = _rows('DELETE FROM rules WHERE id = %s RETURNING id, keyword, tag', id)
    return rows[0] if rows else None
