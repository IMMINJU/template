package app.client.example;

import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

/** 외부 API 의 경로 · 형식 그대로. 구현(프록시)은 Spring 이 만든다 (ExampleConfig) */
@HttpExchange
interface ExampleApi {

	@PostExchange("/example")
	ExampleResponseDto example(@RequestBody ExampleRequestDto request);

}
