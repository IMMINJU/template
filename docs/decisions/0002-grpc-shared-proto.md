# 0002. 서버 간 통신은 gRPC, 계약은 공통 proto 하나

- 상태: 채택
- 날짜: 2026-10-17
- 관련: `contract/proto/`, `contract/buf.yaml`, 각 서버의 gRPC 서비스, ADR-0001

## 맥락

서버가 여러 언어(TS · Java · Python)다. 서버끼리 부를 때도 메시지 형식이 맞아야 한다.
이 템플릿은 서버별 HTTP API 는 각 서버가 소유하고, 서버 간 메시지는 어느 한쪽의 구현과 별개인 공통 proto 로 합의한다.
여러 언어를 쓴다는 이유만으로 contract-first 가 필수인 것은 아니며, HTTP 도 문서를 먼저 쓰는 설계를 선택할 수 있다.

## 결정

- 서버 간 통신의 기본은 gRPC. 계약은 `contract/proto` 하나이고 서버마다 복사하지 않는다(여기서는 proto 가 기준, contract-first).
- buf 로 lint(STANDARD) · 호환 검사(FILE). 디렉터리 = 패키지(`app/tag/v1`).
- 생성: Node = buf + protoc-gen-es(Connect-ES), Spring = protobuf-gradle-plugin(`grpc` 선언만, 버전은 Boot),
  FastAPI = grpcio-tools + mypy-protobuf(타입 스텁). 예시에서는 tags(FastAPI) · activity(Spring)가 서버, notes(Node)가 클라이언트다.
- 필드 번호는 바꾸거나 다시 쓰지 않는다. 지운 필드는 `reserved`, 깨지는 변경은 `v2` 패키지.
- 오류는 gRPC status. 다른 서버의 gRPC 클라이언트는 외부 클라이언트로 보고 테스트에서 Fake 로 바꾼다(ADR-0003).

## 결과

- TS(Connect-ES) · Go(buf curl) → Java(grpc-java) · Python(grpcio) 호출을 확인했다.
- 평문 HTTP/2(h2c)다. 서버 밖으로 열 때는 TLS(mTLS) · 인증부터.
- HTTP(코드 기준)와 gRPC(proto 기준)의 방향이 반대다. 여러 언어가 같은 정의를 읽어야 하느냐가 기준이다.
