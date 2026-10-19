package app.core.api.controller;

import app.core.domain.activity.ActivityService;

import app.storage.db.core.ActivityEntity;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/activity")
class ActivityController {

	private final ActivityService activity;

	ActivityController(ActivityService activity) {
		this.activity = activity;
	}

	// 문서가 이 타입들에서 나온다. 클래스 이름이 openapi 스키마 이름이라 이 서버 안에서 유일하게
	// 응답의 @NotNull 은 문서의 required (원시 타입도 붙여야 한다)

	record Activity(@NotNull long id, @NotNull String action, @NotNull long noteId, @NotNull OffsetDateTime at) {

		static Activity of(ActivityEntity a) {
			return new Activity(a.id(), a.action(), a.noteId(), a.at());
		}

	}

	record ActivityList(@NotNull List<Activity> activities) {
	}

	@GetMapping
	ActivityList listActivity() {
		return new ActivityList(activity.list().stream().map(Activity::of).toList());
	}

}
