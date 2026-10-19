package app;

import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/**
 * 테스트 앞뒤로 모든 테이블을 비운다 (Flyway 이력은 남긴다). 서버는 다른 스레드라 @Transactional rollback 으로는 안 지워진다
 */
class CleanDatabase implements BeforeEachCallback, AfterEachCallback {

	@Override
	public void beforeEach(ExtensionContext context) {
		clean(context);
	}

	@Override
	public void afterEach(ExtensionContext context) {
		clean(context);
	}

	private static void clean(ExtensionContext context) {
		JdbcClient jdbc = SpringExtension.getApplicationContext(context).getBean(JdbcClient.class);
		String tables = jdbc.sql(
				"SELECT string_agg(quote_ident(tablename), ', ') FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'flyway_schema_history'")
			.query(String.class)
			.single();
		if (tables != null) {
			jdbc.sql("TRUNCATE " + tables).update();
		}
	}

}
