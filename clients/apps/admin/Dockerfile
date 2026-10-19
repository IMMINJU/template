# 컨텍스트는 이 폴더, 저장소 루트는 workspace (lockfile · @app/client · contract 타입): docker build --build-context workspace=../../.. .
FROM node:24-slim AS build
# pnpm 버전은 루트 package.json 의 packageManager
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY --from=workspace package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY --from=workspace clients/packages/client/package.json clients/packages/client/
COPY --from=workspace contract/package.json contract/
COPY package.json clients/apps/admin/
RUN --mount=type=cache,target=/root/.cache/pnpm --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --filter @app/admin... --frozen-lockfile
COPY --from=workspace clients/packages/client/src clients/packages/client/src
COPY --from=workspace contract/index.ts contract/
COPY --from=workspace contract/openapi contract/openapi
COPY index.html vite.config.ts tsconfig.json clients/apps/admin/
COPY src clients/apps/admin/src
RUN pnpm --filter @app/admin build

# 정적 파일 + /api 프록시 (이 폴더의 nginx.conf.template). 서버 주소(<서버>_URL)는 실행할 때
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/clients/apps/admin/dist /usr/share/nginx/html
ENV TAGS_URL=http://tags:8002 ACTIVITY_URL=http://activity:8001 TEMPLATES_URL=http://templates:8003
EXPOSE 8080
