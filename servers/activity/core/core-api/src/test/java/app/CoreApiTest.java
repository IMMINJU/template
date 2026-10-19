package app;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 모든 API 테스트의 공통 설정: 실제 HTTP · gRPC 서버를 랜덤 포트로 띄우고, 운영과 같은 엔진(docker 의 Postgres)의 테스트 DB
 * activity_test 를 테스트 앞뒤로 비운다. Fake 가 생기면 IntegrationTestConfig 를 만들어 여기서 @Import 한다.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "spring.datasource.url=jdbc:postgresql://${PGHOST:127.0.0.1}:${PGPORT:5432}/activity_test",
				"spring.grpc.server.port=0" })
@AutoConfigureTestRestTemplate
@ExtendWith(CleanDatabase.class)
public @interface CoreApiTest {

}
