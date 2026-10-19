# Activity 서버

활동 기록: 다른 서버(notes)가 gRPC `ActivityService/Record` 로 남기고, 앱(admin)이 HTTP `GET /api/activity` 로 본다.
Spring Boot 4.1 · Java 25 · Gradle 멀티 모듈. HTTP :8001 · gRPC :9001, DB 는 Postgres(`docker/docker-compose.middleware.yaml`, 먼저 `pnpm infra`).
레포 전체 규칙은 루트 `AGENTS.md`, 이 파일이 이 서버에서는 우선한다. 명령은 이 폴더에서 돈다.

## 구조

레이어(`docs/architecture.md` 서버 레이어)는 패키지와 Gradle 모듈로 나눈다. api · domain · support 는 실행 앱 `core/core-api` 의 패키지,
storage · clients 는 모듈이다. 의존은 `api → domain → storage · clients` 방향만, 패키지는 모두 `app` 아래.

```
core/core-api/                    # 실행 앱(bootJar)
├── build.gradle.kts              # proto → gRPC 코드(protobuf 플러그인), openapi 태스크
└── src/main/
    ├── java/app/
    │   ├── CoreApiApplication.java      # 진입점: app 아래 전부(core · storage · clients)를 읽고, 엄격한 JSON(strictStrings)
    │   └── core/
    │       ├── api/                     # api 레이어
    │       │   ├── controller/ActivityController.java   # HTTP 라우트 + record DTO (Bean Validation = 검증 = 문서)
    │       │   └── grpc/ActivityGrpcService.java        # gRPC 서비스 구현 + 요청 검증
    │       ├── domain/activity/ActivityService.java     # domain 레이어: 업무 로직 (HTTP · gRPC 공용)
    │       └── support/error/ApiErrors.java             # support: HTTP 오류 형식
    └── resources/application.properties # 포트 · 바인딩 · DB 연결 (환경 변수), 모듈 yml 읽기(spring.config.import)
storage/db-core/                  # storage 레이어(모듈): *Repository(JdbcClient)와 그 행 *Entity(record)만 밖에 보인다
├── src/main/java/app/storage/db/core/ActivityRepository.java · ActivityEntity.java
└── src/main/resources/db/migration/V{n}__<이름>.sql  # Flyway. 서버가 뜰 때 적용
clients/client-example/           # clients 레이어(모듈): 외부 시스템 하나당 하나. 예시라 domain 은 아직 안 쓴다(복사해 이름을 바꿔 쓴다)
├── src/main/java/app/client/example/
│   ├── ExampleClient.java              # 교체 지점(public 인터페이스). 밖에는 이것과 model 만 보인다
│   ├── model/ExampleClientResult.java  # 밖에 돌려주는 결과(record)
│   ├── HttpExampleClient.java          # 구현: 요청 DTO 로 바꿔 ExampleApi 를 부르고 응답을 toResult()
│   ├── ExampleApi.java                 # 외부 API 의 경로 · 형식(@HttpExchange 인터페이스, 구현은 Spring 프록시)
│   ├── ExampleRequestDto.java · ExampleResponseDto.java  # 외부 요청 · 응답 형식
│   └── ExampleConfig.java              # @ImportHttpServices(group = "example")
├── src/main/resources/client-example.yml  # spring.http.serviceclient.example: base-url(EXAMPLE_API_URL) · timeout
└── src/test/java/app/client/example/ExampleClient_specs.java  # 외부 계약 테스트 (Fake 외부 서버)
build.gradle.kts                  # 모듈 공통: Java 25 · Boot BOM · javaformat · -Xlint:all -Werror · JUnit. 모듈은 자기 의존성만
settings.gradle.kts               # 모듈 목록 (모듈을 더하면 include)
Dockerfile                        # 이미지 (.dockerignore 가 build · .gradle 을 뺀다)
core/core-api/src/test/java/app/
├── CoreApiTest.java · CleanDatabase.java  # 공통 설정: 랜덤 포트 HTTP · gRPC, 테스트 DB(activity_test), 테스트 앞뒤로 TRUNCATE
├── OpenApiExport.java            # pnpm gen: 실제 서버를 띄워 contract/openapi/activity.json (DB 없이)
├── {resource}/{METHOD}_specs.java   # activity/GET_specs (경로 변수는 하위 패키지: activity/id/GET_specs)
└── grpc/{service}/{Rpc}_specs.java  # grpc/activityservice/Record_specs (패키지는 소문자)
```

## 규칙

- 쓰기는 JSON 본문만 (`@PostMapping` · `@PutMapping(consumes = JSON)`, 아니면 `ApiErrors` 가 400). 모르는 필드는 record 가 버린다.
- 오류는 `{ "error" }` (`ApiErrors`): 검증 실패 · 잘못된 JSON · 잘못된 경로 값(`{id}` 가 숫자가 아니거나 `@Positive` 위반) 400,
  그 외 502, 없는 경로 404, 다른 메서드 405.
- 경로 값에 제약(`@Positive`)이 있으면 본문 검증도 `HandlerMethodValidationException` 으로 온다(`MethodArgumentNotValidException` 이 아니다).
- 바인딩은 `HOST` (`server.address` · `spring.grpc.server.address`, 기본 127.0.0.1). 밖에 열 때 `0.0.0.0`, 그 전에 인증 · TLS.
- DB 연결은 `PGHOST` · `PGPORT` · `PGDATABASE`(기본 `activity`) · `PGUSER` · `PGPASSWORD` (`application.properties`).

## 명령

```bash
./gradlew :core:core-api:bootRun     # pnpm dev
./gradlew test                       # pnpm test
./gradlew :core:core-api:openapi     # pnpm gen → contract/openapi/activity.json (DB 없이 돈다)
./gradlew checkFormat compileJava compileTestJava   # pnpm lint (포맷 + 컴파일러 경고를 오류로)
./gradlew format                     # pnpm format (spring-javaformat, 탭)
docker build --build-context workspace=../.. .   # 이미지 (이 폴더에서)
```

## clients

- 외부 시스템 하나당 모듈 하나(`clients/client-<이름>`, 패키지 `app.client.<이름>`). 새 외부 시스템은 `client-example` 을 복사해 이름을 바꾸고
  `settings.gradle.kts` include · core-api 의존성 · `application.properties` 의 `spring.config.import` 에 더한다.
- 밖에는 `*Client` 인터페이스와 그 결과 `model/*ClientResult` 만 보인다. 요청 · 응답 형식(`*Api` · `*RequestDto` · `*ResponseDto`)과 구현(`Http*Client`)은 모듈 안 package-private.
- HTTP 는 Spring HTTP 서비스 인터페이스(`@HttpExchange` + `@ImportHttpServices(group)`, RestClient). OpenFeign 은 쓰지 않는다.
- 주소 · timeout 은 모듈 yml 의 `spring.http.serviceclient.<group>.base-url` · `connect-timeout` · `read-timeout`. 주소는 환경 변수로 받고 기본은 아무것도 듣지 않는 로컬 포트.
  프록시는 부를 때만 접속한다(앱이 뜰 때 외부에 닿지 않는다).
- 가져온 yml 은 `application.properties` 보다 앞선다. 값을 바꿀 때는 환경 변수 · 테스트 속성(`@DynamicPropertySource`)으로(`SpringApplication` 기본 속성은 진다).
- 외부 5xx 는 `HttpServerErrorException`, 접속 실패 · timeout 은 `ResourceAccessException` 으로 올라와 HTTP 는 502 다(`ApiErrors` 그 외).

## 계약

- springdoc 이 컨트롤러 · record · Bean Validation(`@NotNull` = required, `@Size` = maxLength)에서 문서를 만든다.
- springdoc 은 **테스트 의존성**이다. 운영 앱에는 문서 경로가 없고, `OpenApiExport` 가 실제 서버를 랜덤 포트에 띄워 `/v3/api-docs` 를 받아 쓴다.
  `@CoreApiTest` 를 쓰지 않고 Flyway 를 꺼서 DB 없이 돈다(`pnpm typecheck` 도 gen 을 먼저 돌린다).
- 같은 단순 클래스명 둘은 springdoc 이 **경고 없이 하나로 덮어쓴다**. DTO 는 `{도메인}{역할}`(`Activity` · `ActivityList`, 저장소 행은 `ActivityEntity`)처럼 서버 안에서 유일하게.
- 응답 record 도 필드에 `@NotNull` 을 붙여야 문서에서 required 다(원시 타입 `long` 도). `OffsetDateTime` 은 `string`(date-time).
- operationId 는 메서드 이름이라 `get` 대신 `listActivity` 처럼 짓는다(겹치면 `get_1` 처럼 번호가 붙어 불안정해진다).
- 문자열 필드에 숫자 · 불리언이 오면 400 이다(Jackson 강제 변환을 끔, `strictStrings`). 끄면 `{"text": 1}` 이 `"1"` 로 저장된다.

## gRPC

- `core/core-api` 가 `../../../../contract/proto` 에서 생성한다. protobuf-gradle-plugin 에 `plugins { create("grpc") }` 선언만 두면
  Boot 플러그인이 protoc · grpc-java 버전과 태스크를 맞춘다(직접 `generateProtoTasks` 를 쓰면 중복으로 실패한다).
- 생성 코드(`build/generated`)는 포맷 검사에서 뺀다.
- 요청 검증은 서비스 구현(`ActivityGrpcService`)에서 하고, 실패는 `onError(Status.INVALID_ARGUMENT...)` 로 바로 돌려준다.
  여기서 처리하지 않은 예외는 UNKNOWN. domain 예외를 status 로 바꿔야 하면 `GrpcExceptionHandler` Bean 하나를 support 에 둔다.

## 테스트

- `@CoreApiTest`: `RANDOM_PORT` + `TestRestTemplate`, gRPC 포트 0, 테스트 DB `activity_test`(운영과 같은 Postgres), `CleanDatabase` 가 테스트 앞뒤로 모든 표를 `TRUNCATE` 한다(Flyway 이력은 둔다).
  서버는 다른 스레드라 `@Transactional` rollback 을 가정하지 않는다.
- 파일 `core/core-api/src/test/java/app/activity/GET_specs.java`, 경로 변수 `{id}` 는 하위 패키지(`app/activity/id/GET_specs.java`),
  gRPC 는 `app/grpc/activityservice/Record_specs.java`(Java 패키지는 소문자).
  `@DisplayName("GET /api/activity")` · `@DisplayName("/app.activity.v1.ActivityService/Record")`, 메서드 `void 기록을_최근_것부터_반환한다()`.
- 준비 · 저장 상태 확인은 저장소(`ActivityRepository`)로. id 는 DB 가 매기고 `TRUNCATE` 가 되돌리지 않으니 저장소가 돌려준 id 를 쓴다(1 을 가정하지 않는다).
- gRPC 클라이언트는 `@LocalGrpcServerPort` + `ManagedChannel` + blocking stub.
- 응답은 `ParameterizedTypeReference<Map<String, Object>>` 처럼 타입을 적어 받는다(원시 `Map` 은 `-Werror` 에 걸린다). 작은 JSON 정수는 `Integer` 로 읽히니
  기대값도 `(int) a.id()`, 시각은 문자열이라 `OffsetDateTime.parse` 로 비교한다. 본문 없는 204 는 `String.class` 로 받아 `null` 을 본다.
- 외부 클라이언트는 `@MockitoBean` 대신 Fake 를 `@TestConfiguration` 의 `@Primary` Bean 으로(`IntegrationTestConfig` 를 만들어 `@CoreApiTest` 에 `@Import`).
  실제 Bean 이 만들 때 외부에 접속하면 조건부 등록으로 막는다. hook 이 `@MockitoBean *Client` 를 막는다.
- clients 모듈은 자기 안에 외부 계약 테스트(`ExampleClient_specs`)를 둔다: JDK `HttpServer` 를 포트 0 에 Fake 외부 서버로 띄우고
  `@DynamicPropertySource` 로 `base-url` 만 바꿔, 보낸 요청 · 바꾼 결과 · 5xx 예외를 본다. 모듈 안 최소 앱(`@SpringBootApplication` 중첩 클래스)이라 DB 가 없어도 돈다.

## 주의

- 스키마 변경은 새 `V{n}__*.sql`. main 에 들어간 마이그레이션은 고치지 않는다(체크섬이 어긋나 서버가 뜨지 않는다, hook 이 막는다).
- javac 경고는 오류다. `serial` 만 끈다(예외 클래스는 직렬화하지 않는다).
