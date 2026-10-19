"""POST /api/tags/rules"""

import json

import pytest

from server.storage import rules


def post(client, body):
    return client.post(
        '/api/tags/rules', content=json.dumps(body), headers={'content-type': 'application/json'}
    )


def test_올바른_규칙을_보내면_201_Created와_만든_규칙을_반환하고_DB에_저장된다(client):
    res = post(client, {'keyword': '회의', 'tag': '회의', 'junk': 1})

    [saved] = rules.find_all()
    assert res.status_code == 201
    assert res.json() == {'id': saved.id, 'keyword': '회의', 'tag': '회의'}
    assert saved == rules.Rule(id=saved.id, keyword='회의', tag='회의')


@pytest.mark.parametrize(
    'body',
    [
        None,
        [],
        'x',
        {},
        {'keyword': '회의'},
        {'tag': '회의'},
        {'keyword': '', 'tag': '회의'},
        {'keyword': '회의', 'tag': ''},
        {'keyword': 1, 'tag': '회의'},
        {'keyword': '회의', 'tag': 1},
        {'keyword': 'x' * 101, 'tag': '회의'},
        {'keyword': '회의', 'tag': 'x' * 31},
    ],
)
def test_규칙이_비었거나_문자열이_아니거나_너무_길면_400_Bad_Request를_반환하고_저장하지_않는다(
    client, body
):
    res = post(client, body)

    assert res.status_code == 400
    assert isinstance(res.json()['error'], str)
    assert rules.find_all() == []


def test_가장_긴_키워드와_태그는_저장된다(client):
    res = post(client, {'keyword': 'x' * 100, 'tag': 'y' * 30})

    assert res.status_code == 201
    assert [(r.keyword, r.tag) for r in rules.find_all()] == [('x' * 100, 'y' * 30)]


def test_JSON이_아닌_본문은_400_Bad_Request를_반환한다(client):
    res = client.post(
        '/api/tags/rules',
        content='keyword=a&tag=b',
        headers={'content-type': 'application/x-www-form-urlencoded'},
    )

    assert res.status_code == 400
    assert res.json() == {'error': 'JSON 본문이 필요합니다'}
    assert rules.find_all() == []
