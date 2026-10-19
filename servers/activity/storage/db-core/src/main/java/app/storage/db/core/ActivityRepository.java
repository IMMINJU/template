package app.storage.db.core;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 활동 기록 (activity 표, id · at 은 DB 가 매긴다) */
@Repository
public class ActivityRepository {

	private final JdbcClient jdbc;

	ActivityRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** 최근 것부터 limit 개 */
	public List<ActivityEntity> findRecent(int limit) {
		return this.jdbc.sql("SELECT id, action, note_id, at FROM activity ORDER BY id DESC LIMIT ?")
			.param(limit)
			.query(ActivityEntity.class)
			.list();
	}

	public ActivityEntity create(String action, long noteId) {
		return this.jdbc.sql("INSERT INTO activity (action, note_id) VALUES (?, ?) RETURNING id, action, note_id, at")
			.param(action)
			.param(noteId)
			.query(ActivityEntity.class)
			.single();
	}

}
