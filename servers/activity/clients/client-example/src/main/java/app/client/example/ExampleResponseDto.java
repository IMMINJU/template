package app.client.example;

import app.client.example.model.ExampleClientResult;

/** 외부 API 응답 본문 (모듈 밖에 보이지 않는다). 밖에는 toResult() 로 바꿔 준다 */
record ExampleResponseDto(String exampleResponseValue) {

	ExampleClientResult toResult() {
		return new ExampleClientResult(this.exampleResponseValue);
	}

}
