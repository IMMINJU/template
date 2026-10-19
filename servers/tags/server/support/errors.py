from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException


class ApiError(BaseModel):
    """오류 형식 (모든 서버 공통): { "error": "..." }. 잘못된 입력 400, 그 외 502"""

    error: str


class NotFound(Exception):
    """없는 자원 → 404 { error: 메시지 }. domain 이 던진다"""


def install(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def invalid(request: Request, e: RequestValidationError):
        fields = dict.fromkeys(str(x['loc'][-1]) for x in e.errors())
        return JSONResponse(
            {'error': f'입력이 올바르지 않습니다: {", ".join(fields)}'}, status_code=400
        )

    @app.exception_handler(NotFound)
    async def not_found(request: Request, e: NotFound):
        return JSONResponse({'error': str(e)}, status_code=404)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, e: HTTPException):
        message = {404: 'not found', 405: 'method not allowed'}.get(e.status_code, str(e.detail))
        return JSONResponse({'error': message}, status_code=e.status_code, headers=e.headers)

    @app.exception_handler(Exception)
    async def upstream(request: Request, e: Exception):
        # 오류 메시지를 그대로 내보낸다 (밖에 열면 502 는 감추고 로그로)
        return JSONResponse({'error': str(e)}, status_code=502)

    def openapi():
        """문서도 실제 오류 형식대로: 검증 실패는 FastAPI 기본 422 가 아니라 400 { error }"""
        if app.openapi_schema is None:
            doc = get_openapi(title=app.title, version=app.version, routes=app.routes)
            bad = {
                'description': '잘못된 요청',
                'content': {
                    'application/json': {'schema': {'$ref': '#/components/schemas/ApiError'}}
                },
            }
            for path in doc['paths'].values():
                for op in path.values():
                    if op['responses'].pop('422', None):
                        op['responses']['400'] = bad
            schemas = doc['components']['schemas']
            schemas.pop('HTTPValidationError', None)
            schemas.pop('ValidationError', None)
            schemas['ApiError'] = ApiError.model_json_schema()
            app.openapi_schema = doc
        return app.openapi_schema

    app.openapi = openapi
