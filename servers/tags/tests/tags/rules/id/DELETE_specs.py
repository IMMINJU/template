"""DELETE /api/tags/rules/{id}"""

import pytest

from server.storage import rules


def test_저장된_규칙을_지우면_204_No_Content를_반환하고_DB에서_지워진다(client):
    # Arrange
    rule = rules.create('회의', '회의')
    other = rules.create('버그', '버그')

    # Act
    res = client.delete(f'/api/tags/rules/{rule.id}')

    # Assert
    assert res.status_code == 204
    assert res.content == b''
    assert rules.find_all() == [other]


def test_없는_id면_404_Not_Found를_반환한다(client):
    rule = rules.create('회의', '회의')

    res = client.delete(f'/api/tags/rules/{rule.id + 1}')

    assert res.status_code == 404
    assert res.json() == {'error': '규칙이 없습니다'}
    assert rules.find_all() == [rule]


@pytest.mark.parametrize('id', ['abc', '1.5', '0', '-1'])
def test_id가_양의_정수가_아니면_400_Bad_Request를_반환한다(client, id):
    rule = rules.create('회의', '회의')

    res = client.delete(f'/api/tags/rules/{id}')

    assert res.status_code == 400
    assert isinstance(res.json()['error'], str)
    assert rules.find_all() == [rule]
