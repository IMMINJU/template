package app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import tools.jackson.databind.cfg.CoercionAction;
import tools.jackson.databind.cfg.CoercionInputShape;
import tools.jackson.databind.type.LogicalType;

/** 패키지 app 아래 전부 (core = 이 앱, storage = DB 모듈) 를 읽는다 */
@SpringBootApplication
public class CoreApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(CoreApiApplication.class, args);
	}

	/** 문서에 적힌 타입 그대로만 받는다: 문자열 필드에 숫자 · 불리언이 오면 400 ({"text": 1} 을 "1" 로 받지 않게) */
	@Bean
	JsonMapperBuilderCustomizer strictStrings() {
		return (builder) -> builder.withCoercionConfig(LogicalType.Textual,
				(c) -> c.setCoercion(CoercionInputShape.Integer, CoercionAction.Fail)
					.setCoercion(CoercionInputShape.Float, CoercionAction.Fail)
					.setCoercion(CoercionInputShape.Boolean, CoercionAction.Fail));
	}

}
