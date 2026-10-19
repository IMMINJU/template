package app.core.domain.activity;

import app.storage.db.core.ActivityEntity;
import app.storage.db.core.ActivityRepository;
import java.util.List;
import org.springframework.stereotype.Service;

/** 활동 기록 업무 로직. 기록은 gRPC(Record), 목록은 HTTP 가 쓴다 */
@Service
public class ActivityService {

	private final ActivityRepository activity;

	ActivityService(ActivityRepository activity) {
		this.activity = activity;
	}

	/** 최근 것부터 최대 100개 */
	public List<ActivityEntity> list() {
		return this.activity.findRecent(100);
	}

	public void record(String action, long noteId) {
		this.activity.create(action, noteId);
	}

}
