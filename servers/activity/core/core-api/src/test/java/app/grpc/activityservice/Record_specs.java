package app.grpc.activityservice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import app.CoreApiTest;
import app.activity.v1.ActivityServiceGrpc;
import app.activity.v1.RecordRequest;
import app.activity.v1.RecordResponse;
import app.storage.db.core.ActivityEntity;
import app.storage.db.core.ActivityRepository;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.grpc.test.autoconfigure.LocalGrpcServerPort;

@DisplayName("/app.activity.v1.ActivityService/Record")
@CoreApiTest
class Record_specs {

	@LocalGrpcServerPort
	int port;

	@Autowired
	ActivityRepository activity;

	ManagedChannel channel;

	ActivityServiceGrpc.ActivityServiceBlockingStub client;

	@BeforeEach
	void connect() {
		// 다른 서버가 부르는 것과 같은 실제 gRPC 연결
		channel = ManagedChannelBuilder.forAddress("127.0.0.1", port).usePlaintext().build();
		client = ActivityServiceGrpc.newBlockingStub(channel);
	}

	@AfterEach
	void disconnect() {
		channel.shutdownNow();
	}

	@Test
	void 올바른_기록을_보내면_DB에_저장된다() {
		// Act
		var res = client.record(RecordRequest.newBuilder().setAction("note.created").setNoteId(7).build());

		// Assert
		assertThat(res).isEqualTo(RecordResponse.getDefaultInstance());
		assertThat(activity.findRecent(100)).extracting(ActivityEntity::action, ActivityEntity::noteId)
			.containsExactly(tuple("note.created", 7L));
	}

	@Test
	void action이_비었거나_note_id가_양수가_아니면_INVALID_ARGUMENT를_반환하고_저장하지_않는다() {
		for (var req : new RecordRequest[] { RecordRequest.newBuilder().setNoteId(7).build(),
				RecordRequest.newBuilder().setAction(" ").setNoteId(7).build(),
				RecordRequest.newBuilder().setAction("note.created").build(),
				RecordRequest.newBuilder().setAction("note.created").setNoteId(-1).build() }) {
			assertThatThrownBy(() -> client.record(req)).as(req.toString())
				.isInstanceOfSatisfying(StatusRuntimeException.class,
						(e) -> assertThat(e.getStatus().getCode()).isEqualTo(Status.Code.INVALID_ARGUMENT));
		}
		assertThat(activity.findRecent(100)).isEmpty();
	}

}
