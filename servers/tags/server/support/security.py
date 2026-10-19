from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def install(app: FastAPI) -> None:
    @app.middleware('http')
    async def json_only(request: Request, call_next):
        # JSON 본문만 받는다 (form 같은 단순 요청으로는 다른 사이트가 몰래 보낼 수 있다)
        if request.method in ('POST', 'PUT') and not request.headers.get(
            'content-type', ''
        ).startswith('application/json'):
            return JSONResponse({'error': 'JSON 본문이 필요합니다'}, status_code=400)
        return await call_next(request)
