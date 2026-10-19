# 컨텍스트는 이 폴더, 저장소 루트는 workspace (contract/proto 에서 gRPC 코드를 만든다): docker build --build-context workspace=../.. .
FROM python:3.12-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /bin/
# 이미지의 Python 을 쓴다 (uv 가 따로 받지 않게)
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy
WORKDIR /src/servers/tags
# protoc 플러그인(protoc-gen-mypy) · uvicorn 을 찾게
ENV PATH=/src/servers/tags/.venv/bin:$PATH
COPY pyproject.toml uv.lock .python-version ./

# proto → gen/ 은 dev 의존성(grpcio-tools)이 있는 단계에서만 만든다
FROM base AS gen
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen
COPY --from=workspace contract/proto /src/contract/proto
COPY server server
RUN python -m server.gen proto

FROM base
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev
COPY server server
# 서버가 뜰 때 적용한다 (설정은 pyproject.toml 의 [tool.alembic])
COPY migrations migrations
COPY --from=gen /src/servers/tags/gen gen
USER 1000
ENV HOST=0.0.0.0
EXPOSE 8002 9002
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8002"]
