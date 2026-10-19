# 0003. 테스트는 실제 서버를 띄운 API 통합 테스트, 외부는 Fake

- 상태: 채택
- 날짜: 2026-10-17
- 관련: `docs/testing.md`, `docker/`, `.claude/hooks/check-patterns.py`

## 맥락

외부 API · 스토리지 · 메일을 테스트마다 다 띄우기는 어렵고, 내부 로직까지 대역으로 바꾸면 검증하려던 흐름이 사라진다.
테스트가 통과했을 때 무엇을 보장하는지 정하고 그에 맞춰 경계와 대역을 고른다.

## 결정

- 기본은 서비스 범위의 API 통합 테스트: 실제 서버를 랜덤 포트로 띄우고 HTTP · gRPC 로 부른다. api · domain · storage 는 실제 구현,
  외부 클라이언트(clients)만 Fake.
- 테스트 DB 는 운영과 같은 엔진(Postgres)이다. `docker/` 의 compose(개발 · CI 와 같은 파일)에 서버마다 `<서버>_test` 를 두고
  테스트 앞뒤로 비운다. 서버는 다른 스레드라 rollback 을 가정하지 않는다.
- 이미지 · 네트워크는 전체 스택(`docker/docker-compose.yaml`, 서버 · 웹 앱)을 띄운 smoke 로 본다.
- 이름: 디렉터리 = 리소스 경로, 파일 = `{METHOD}_specs`, gRPC 는 `grpc/{Service}/{Rpc}_specs`, 테스트 이름은 한글_밑줄 조건 · 결과.
- Fake 는 외부 조건만 통제(반환값 · 다음 호출 실패 · 기록 · 보류)하고 `reset()` 한다. 업무 정책 · 재시도를 Fake 에 다시 구현하지 않는다.
- mock 으로 외부 클라이언트를 바꾸지 않는다(`@MockitoBean`, `mock.module`, `patch`). hook 이 막는다.

## 결과

- HTTP 응답 · 저장 상태 · 부수 효과를 같은 테스트에서 본다. 저장 상태는 storage 의 저장소로 확인한다.
- 테스트에 Docker 가 필요하다(`pnpm infra`). 대신 메모리 DB 와 운영 DB 의 차이(SQL 문법 · 타입 · 제약)를 테스트가 잡는다.
- 인증 · 브라우저 · 프록시 · 실제 외부 서비스는 범위 밖이다. 필요하면 따로 둔다(verify-local skill 은 브라우저까지).
- 같은 Fake · DB 를 쓰는 테스트는 병렬로 돌리지 않는다.
