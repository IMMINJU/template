# 컨텍스트는 이 폴더, 저장소 루트는 workspace (contract/proto 에서 gRPC 코드를 만든다): docker build --build-context workspace=../.. .
FROM eclipse-temurin:25-jdk AS build
COPY --from=workspace contract/proto /src/contract/proto
WORKDIR /src/servers/activity
COPY . .
RUN --mount=type=cache,target=/root/.gradle ./gradlew :core:core-api:bootJar --no-daemon -q

FROM eclipse-temurin:25-jre
COPY --from=build /src/servers/activity/core/core-api/build/libs/core-api.jar /app.jar
USER 1000
# 컨테이너 밖에서 받게 연다. 인증 · TLS 는 밖에 열기 전에
ENV HOST=0.0.0.0
EXPOSE 8001 9001
ENTRYPOINT ["java", "-jar", "/app.jar"]
