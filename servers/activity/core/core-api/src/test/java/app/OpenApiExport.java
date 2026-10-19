package app;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.TestPropertySource;

/**
 * `pnpm gen` (./gradlew :core:core-api:openapi) 만 실행한다: 실제 서버의 /v3/api-docs →
 * contract/openapi/activity.json. springdoc 은 테스트에만 있어서 운영 앱에는 문서 경로가 없다. DB 없이 돈다(Flyway
 * 를 끄고, 연결은 처음 쿼리할 때 열린다) — pnpm typecheck 도 gen 을 먼저 돌린다
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "spring.flyway.enabled=false", "spring.grpc.server.port=0" })
@AutoConfigureTestRestTemplate
@EnabledIfSystemProperty(named = "openapi.out", matches = ".+")
@TestPropertySource(properties = { "springdoc.default-produces-media-type=application/json",
		"springdoc.writer-with-order-by-keys=true", "springdoc.writer-with-default-pretty-printer=true" })
class OpenApiExport {

	@Autowired
	TestRestTemplate client;

	@Test
	void 문서를_내보낸다() throws Exception {
		String doc = this.client.getForObject("/v3/api-docs", String.class);
		Files.writeString(Path.of(System.getProperty("openapi.out")), doc + "\n");
	}

	/** servers 를 고정해야 문서에 랜덤 포트가 안 들어간다 */
	@TestConfiguration
	static class Document {

		@Bean
		OpenAPI openApi() {
			return new OpenAPI().info(new Info().title("activity").version("0.0.0"))
				.servers(List.of(new Server().url("/")));
		}

	}

}
