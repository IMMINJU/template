package app.core.api.grpc;

import app.core.domain.activity.ActivityService;

import app.activity.v1.ActivityServiceGrpc;
import app.activity.v1.RecordRequest;
import app.activity.v1.RecordResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;

/**
 * contract/proto 의 app.activity.v1.ActivityService (서버 간 통신). 입력 검증은 여기서, 실패는
 * INVALID_ARGUMENT
 */
@Service
class ActivityGrpcService extends ActivityServiceGrpc.ActivityServiceImplBase {

	private final ActivityService activity;

	ActivityGrpcService(ActivityService activity) {
		this.activity = activity;
	}

	@Override
	public void record(RecordRequest request, StreamObserver<RecordResponse> response) {
		if (request.getAction().isBlank() || request.getNoteId() <= 0) {
			response.onError(Status.INVALID_ARGUMENT.withDescription("action 과 양수 note_id 가 필요합니다").asException());
			return;
		}
		activity.record(request.getAction(), request.getNoteId());
		response.onNext(RecordResponse.getDefaultInstance());
		response.onCompleted();
	}

}
