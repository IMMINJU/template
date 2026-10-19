import grpc
from app.tag.v1 import tag_pb2, tag_pb2_grpc

from server.domain import rules


class TagService(tag_pb2_grpc.TagServiceServicer):
    """contract/proto 의 app.tag.v1.TagService (notes 가 메모를 저장하기 전에 부른다)"""

    def Suggest(
        self, request: tag_pb2.SuggestRequest, context: grpc.ServicerContext
    ) -> tag_pb2.SuggestResponse:
        return tag_pb2.SuggestResponse(tags=rules.suggest(request.text))


def add(server: grpc.Server) -> None:
    tag_pb2_grpc.add_TagServiceServicer_to_server(TagService(), server)
