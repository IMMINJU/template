"""GET /api/tags/rules"""

from server.storage import rules


def test_저장된_규칙을_만든_순서대로_반환한다(client):
    # Arrange
    first = rules.create('회의', '회의')
    second = rules.create('todo', '할일')

    # Act
    res = client.get('/api/tags/rules')

    # Assert
    assert res.status_code == 200
    assert res.json() == {
        'rules': [
            {'id': first.id, 'keyword': '회의', 'tag': '회의'},
            {'id': second.id, 'keyword': 'todo', 'tag': '할일'},
        ]
    }


def test_규칙이_없으면_빈_목록을_반환한다(client):
    res = client.get('/api/tags/rules')

    assert res.status_code == 200
    assert res.json() == {'rules': []}
