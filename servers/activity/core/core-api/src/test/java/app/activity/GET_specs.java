package app.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import app.CoreApiTest;
import app.storage.db.core.ActivityRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;

@DisplayName("GET /api/activity")
@CoreApiTest
class GET_specs {

	private static final ParameterizedTypeReference<Map<String, List<Map<String, Object>>>> JSON = new ParameterizedTypeReference<>() {
	};

	@Autowired
	TestRestTemplate client;

	@Autowired
	ActivityRepository activity;

	@Test
	void 기록을_최근_것부터_반환한다() {
		// Arrange
		var first = activity.create("note.created", 7);
		var second = activity.create("note.updated", 7);

		// Act
		var res = client.exchange("/api/activity", HttpMethod.GET, null, JSON);

		// Assert (작은 JSON 정수는 Integer 로, at 은 ISO 8601 문자열로 온다)
		assertThat(res.getStatusCode().value()).isEqualTo(200);
		assertThat(res.getBody().get("activities"))
			.extracting((a) -> a.get("id"), (a) -> a.get("action"), (a) -> a.get("noteId"),
					(a) -> OffsetDateTime.parse((String) a.get("at")).toInstant())
			.containsExactly(tuple((int) second.id(), "note.updated", 7, second.at().toInstant()),
					tuple((int) first.id(), "note.created", 7, first.at().toInstant()));
	}

	@Test
	void 기록이_100개를_넘으면_최근_100개만_반환한다() {
		var oldest = activity.create("note.created", 1);
		for (int i = 0; i < 100; i++) {
			activity.create("note.updated", 1);
		}

		var res = client.exchange("/api/activity", HttpMethod.GET, null, JSON);

		assertThat(res.getStatusCode().value()).isEqualTo(200);
		assertThat(res.getBody().get("activities")).hasSize(100)
			.extracting((a) -> a.get("id"))
			.doesNotContain((int) oldest.id());
	}

	@Test
	void 기록이_없으면_빈_목록을_반환한다() {
		var res = client.exchange("/api/activity", HttpMethod.GET, null, JSON);

		assertThat(res.getStatusCode().value()).isEqualTo(200);
		assertThat(res.getBody()).isEqualTo(Map.of("activities", List.of()));
	}

}
