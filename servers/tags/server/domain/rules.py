"""태그 규칙 업무 로직. HTTP(규칙 관리) · gRPC(Suggest) 가 같이 쓴다"""

from server.storage import rules
from server.storage.rules import Rule
from server.support.errors import NotFound


def find_all() -> list[Rule]:
    return rules.find_all()


def create(keyword: str, tag: str) -> Rule:
    return rules.create(keyword, tag)


def delete(id: int) -> None:
    if rules.delete(id) is None:
        raise NotFound('규칙이 없습니다')


def suggest(text: str) -> list[str]:
    """keyword 가 text 에 들어 있는 규칙의 tag. 대소문자 무시, 같은 태그는 한 번, 규칙 id 순"""
    # ponytail: 부를 때마다 규칙을 전부 읽는다. 규칙이 많아지면 캐시나 SQL 로
    text = text.casefold()
    return list(dict.fromkeys(r.tag for r in rules.find_all() if r.keyword.casefold() in text))
