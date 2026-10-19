package app.client.example;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.client.example.model.ExampleClientResult;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.HttpServerErrorException;

/**
 * 외부 계약 테스트: 이 모듈(어댑터)이 외부 API 에 보내는 요청과 응답을 바꾸는 방법을 확인한다. 외부 시스템은 JDK HttpServer 로 만든
 * Fake, 설정은 앱과 같이 client-example.yml 을 읽고 주소만 Fake 로 바꾼다. 앱(core)의 테스트는 이 모듈 대신
 * ExampleClient 의 Fake 를 쓴다.
 */
@DisplayName("ExampleClient")
@SpringBootTest(properties = "spring.config.import=classpath:client-example.yml")
class ExampleClient_specs {

	static HttpServer exampleApi;

	static volatile Received received;

	static volatile int status;

	static volatile String responseBody;

	@BeforeAll
	static void start() throws IOException {
		exampleApi = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		exampleApi.createContext("/", (exchange) -> {
			received = new Received(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
					exchange.getRequestHeaders().getFirst("Content-Type"),
					new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().set("Content-Type", "application/json");
			exchange.sendResponseHeaders(status, body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		exampleApi.start();
	}

	@AfterAll
	static void stop() {
		exampleApi.stop(0);
	}

	@DynamicPropertySource
	static void exampleApiUrl(DynamicPropertyRegistry registry) {
		registry.add("spring.http.serviceclient.example.base-url",
				() -> "http://127.0.0.1:" + exampleApi.getAddress().getPort());
	}

	@Autowired
	ExampleClient client;

	@Test
	void 요청을_JSON_으로_보내고_응답을_결과로_바꾼다() {
		// Arrange
		status = 200;
		responseBody = "{\"exampleResponseValue\":\"pong\"}";

		// Act
		var result = this.client.example("ping");

		// Assert
		assertThat(received)
			.isEqualTo(new Received("POST", "/example", "application/json", "{\"exampleRequestValue\":\"ping\"}"));
		assertThat(result).isEqualTo(new ExampleClientResult("pong"));
	}

	@Test
	void 외부가_5xx_를_돌려주면_예외를_던진다() {
		status = 503;
		responseBody = "{}";

		assertThatThrownBy(() -> this.client.example("ping")).isInstanceOf(HttpServerErrorException.class);
	}

	record Received(String method, String path, String contentType, String body) {
	}

	/** 이 모듈만 읽는 최소 앱 (app.client.example 아래 + 자동 설정) */
	@SpringBootApplication
	static class ExampleClientTestApplication {

	}

}
