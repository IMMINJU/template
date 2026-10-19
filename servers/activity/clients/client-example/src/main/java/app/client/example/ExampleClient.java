package app.client.example;

import app.client.example.model.ExampleClientResult;

/** 교체 지점: 밖(core)은 이 인터페이스만 본다. 테스트는 Fake 를 @Primary Bean 으로 넣는다 */
public interface ExampleClient {

	ExampleClientResult example(String exampleParameter);

}
