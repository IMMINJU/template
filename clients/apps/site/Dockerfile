# 컨텍스트는 이 폴더, 저장소 루트는 workspace (lockfile · @app/client · contract 타입): docker build --build-context workspace=../../.. .
FROM node:24-slim AS build
# pnpm 버전은 루트 package.json 의 packageManager
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN corepack enable
WORKDIR /app
COPY --from=workspace package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY --from=workspace clients/packages/client/package.json clients/packages/client/
COPY --from=workspace contract/package.json contract/
COPY package.json clients/apps/site/
RUN --mount=type=cache,target=/root/.cache/pnpm --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --filter @app/site... --frozen-lockfile
COPY --from=workspace clients/packages/client/src clients/packages/client/src
COPY --from=workspace contract/index.ts contract/
COPY --from=workspace contract/openapi contract/openapi
COPY next.config.ts tsconfig.json clients/apps/site/
COPY app clients/apps/site/app
# /api/notes rewrites 의 주소는 빌드 때 정해진다
ARG NOTES_URL=http://notes:8000
RUN pnpm --filter @app/site build

# standalone: 실행에 쓰는 파일만 추린 것 (저장소 구조 그대로). 정적 파일은 따로 옮긴다
FROM node:24-slim
WORKDIR /app
COPY --from=build /app/clients/apps/site/.next/standalone ./
COPY --from=build /app/clients/apps/site/.next/static clients/apps/site/.next/static
USER node
# NOTES_URL: 서버 컴포넌트가 실행할 때 부르는 notes 서버
ENV HOSTNAME=0.0.0.0 PORT=3000 NOTES_URL=http://notes:8000 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["node", "clients/apps/site/server.js"]
