# 컨텍스트는 이 폴더, 저장소 루트는 workspace (lockfile · contract): docker build --build-context workspace=../.. .
FROM node:24-slim AS deps
# pnpm 버전은 루트 package.json 의 packageManager
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY --from=workspace package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=workspace contract/package.json contract/
COPY package.json servers/notes/
RUN --mount=type=cache,target=/root/.cache/pnpm --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --filter @app/notes... --prod --frozen-lockfile

# 실행 이미지에는 node_modules 와 소스 · 마이그레이션만 (pnpm · 캐시는 두고 온다)
FROM node:24-slim
COPY --from=deps /app /app
COPY --from=workspace contract/gen /app/contract/gen
COPY src /app/servers/notes/src
COPY migrations /app/servers/notes/migrations
WORKDIR /app/servers/notes
USER node
ENV HOST=0.0.0.0
EXPOSE 8000
CMD ["node", "src/main.ts"]
