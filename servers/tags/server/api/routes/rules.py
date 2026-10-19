from typing import Annotated

from fastapi import APIRouter, Path
from pydantic import BaseModel, ConfigDict, Field

from server.domain import rules as service

# 핸들러는 def: DB 드라이버가 동기라 FastAPI 가 스레드풀에서 부른다 (async def 면 이벤트 루프가 막힌다)
router = APIRouter()

# 양의 정수(DB 의 BIGINT 안)가 아니면 400
Id = Annotated[int, Path(gt=0, le=2**63 - 1)]


class RuleInput(BaseModel):
    """검증 · 문서가 이 모델 하나에서 나온다. 클래스 이름이 openapi 스키마 이름이라 이 서버 안에서 유일하게.
    모르는 필드는 버린다 (pydantic 기본). 문자열 자리에 숫자가 오면 400"""

    keyword: str = Field(min_length=1, max_length=100)
    tag: str = Field(min_length=1, max_length=30)


class Rule(BaseModel):
    # storage 의 Rule 을 그대로 받는다
    model_config = ConfigDict(from_attributes=True)

    id: int
    keyword: str
    tag: str


class RuleList(BaseModel):
    rules: list[Rule]


@router.get('/api/tags/rules')
def list_rules() -> RuleList:
    return RuleList(rules=[Rule.model_validate(r) for r in service.find_all()])


@router.post('/api/tags/rules', status_code=201)
def create_rule(body: RuleInput) -> Rule:
    return Rule.model_validate(service.create(body.keyword, body.tag))


@router.delete('/api/tags/rules/{id}', status_code=204)
def delete_rule(id: Id) -> None:
    service.delete(id)
