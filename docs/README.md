# 문서

규칙 · 참조:

| 문서 | 내용 |
|---|---|
| [architecture.md](architecture.md) | 레포 구조, 서버 레이어, 서버 공통 규칙, 클라이언트 공통 규칙(createClient · 앱의 프록시 · TanStack Query · 카탈로그 · UI) |
| [contracts.md](contracts.md) | HTTP(서버 코드 → openapi → 클라이언트 타입) · gRPC(공통 proto) 계약과 이름 규칙 |
| [languages.md](languages.md) | 같은 일(HTTP 목록 · gRPC · 마이그레이션 · 테스트)을 Node · FastAPI · Spring · Go 로 나란히 |
| [testing.md](testing.md) | 테스트 규칙: 실행 경계 · 인프라 · 이름 · 본문 · Fake · 격리 |
| [development.md](development.md) | 명령 · 포트 · 환경 변수 · 인프라(docker) · 이미지 · CI · 의존성 설치 · 이름 바꾸기 · 예시 빼기 |
| [decisions/](decisions/README.md) | 설계 결정(ADR) |

이해하기 (규칙이 왜 이렇게 됐는지):

| 문서 | 내용 |
|---|---|
| [concepts/structure.md](concepts/structure.md) | 한 저장소 · 계약 하나 · 코드 기준 HTTP 와 proto 기준 gRPC · 서버 레이어 · 공통 규칙의 이유와 대가 |
| [concepts/testing.md](concepts/testing.md) | 실제 서버 · 실제 Postgres · TRUNCATE · Fake(mock 이 아닌) · 이름 규칙의 이유, 테스트 하나 읽기 |

절차:

| 문서 | 내용 |
|---|---|
| [guides/add-endpoint.md](guides/add-endpoint.md) | 엔드포인트 추가: 업무 로직 → 라우트 → 테스트 → 계약 생성 → 클라이언트, 쓰기 엔드포인트에서 달라지는 곳 |
| [guides/contract-lab.md](guides/contract-lab.md) | HTTP 필드 · proto 번호를 바꿔 타입 검사와 호환 검사를 실패시키고 복구하기 |
| [guides/external-service-lab.md](guides/external-service-lab.md) | 실제 서버 · DB 는 그대로 두고 외부 요약 서비스를 Fake 로 바꿔 실패 재현하기 |
| [guides/call-server.md](guides/call-server.md) | 다른 서버 부르기: proto → 받는 서버 → clients → 실패했을 때 할 일 → Fake 테스트 → 연결 |
| [guides/add-server.md](guides/add-server.md) · [add-app.md](guides/add-app.md) | 서버 · 앱을 더하거나 빼거나 이름을 바꿀 때 채우는 연결 지점 |
| [guides/database.md](guides/database.md) | 스키마 바꾸기, 개발 DB 처음부터, 다른 DB 로 |
| [guides/auth.md](guides/auth.md) | 인증 붙이기: 정할 것 · 붙일 자리 · 에이전트에게 맡기는 요청 예시 (템플릿에는 인증이 없다) |
| [guides/troubleshooting.md](guides/troubleshooting.md) | 자주 겪는 문제: 증상 · 원인 · 해결 |

서버 · 앱마다의 세부(구조 · 명령 · 도구 · 테스트 방법)는 그 폴더의 `AGENTS.md`: `servers/<서버>/` · `clients/apps/<앱>/`.
