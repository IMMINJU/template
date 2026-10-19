package app.client.example;

import app.client.example.model.ExampleClientResult;
import org.springframework.stereotype.Component;

/** ExampleClient 의 실제 구현: 요청 형식으로 바꿔 외부 API 를 부르고, 응답을 결과로 바꾼다 */
@Component
class HttpExampleClient implements ExampleClient {

	private final ExampleApi api;

	HttpExampleClient(ExampleApi api) {
		this.api = api;
	}

	@Override
	public ExampleClientResult example(String exampleParameter) {
		return this.api.example(new ExampleRequestDto(exampleParameter)).toResult();
	}

}
