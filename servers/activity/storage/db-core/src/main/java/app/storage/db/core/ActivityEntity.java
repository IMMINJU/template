package app.storage.db.core;

import java.time.OffsetDateTime;

/** activity 표의 한 행 */
public record ActivityEntity(long id, String action, long noteId, OffsetDateTime at) {
}
