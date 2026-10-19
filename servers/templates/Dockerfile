# 컨텍스트는 이 폴더 (워크스페이스 파일이 필요 없다): docker build .
FROM golang:1.25 AS build
WORKDIR /src
# 의존성을 먼저 받아 소스만 바뀌면 이 층을 다시 쓴다
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -o /templates .

# 실행 이미지에는 바이너리 하나만 (마이그레이션 SQL 은 바이너리 안에, 셸 · 패키지 없음, nonroot 사용자)
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /templates /templates
ENV HOST=0.0.0.0
EXPOSE 8003
ENTRYPOINT ["/templates"]
