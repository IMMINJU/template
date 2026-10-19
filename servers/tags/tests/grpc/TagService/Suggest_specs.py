"""/app.tag.v1.TagService/Suggest"""

from app.tag.v1 import tag_pb2, tag_pb2_grpc

from server.storage import rules


def suggest(channel, text):
    return tag_pb2_grpc.TagServiceStub(channel).Suggest(tag_pb2.SuggestRequest(text=text))


def test_키워드가_들어_있는_규칙의_태그를_규칙_순서대로_반환한다(channel):
    # Arrange
    rules.create('버그', '버그')
    rules.create('회의', '회의')
    rules.create('배포', '배포')

    # Act
    res = suggest(channel, '회의에서 버그 이야기')

    # Assert
    assert res == tag_pb2.SuggestResponse(tags=['버그', '회의'])


def test_대소문자를_가리지_않고_같은_태그는_한_번만_반환한다(channel):
    rules.create('할 일', '할일')
    rules.create('todo', '할일')

    res = suggest(channel, 'TODO: 오늘 할 일')

    assert res.tags == ['할일']


def test_맞는_규칙이_없거나_text가_비었으면_빈_목록을_반환한다(channel):
    rules.create('회의', '회의')

    assert suggest(channel, '점심 메뉴').tags == []
    assert suggest(channel, '').tags == []
