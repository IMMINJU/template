package app.core.support.error;

import java.util.stream.Stream;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** 오류 형식 (모든 서버 공통): { "error": "..." }. 잘못된 입력 400, 없는 것 404, 그 외 502 */
@RestControllerAdvice
public class ApiErrors {

	record ApiError(String error) {
	}

	// JSON 본문만 받는다 (form 같은 단순 요청으로는 못 보내게)
	@ExceptionHandler(HttpMediaTypeNotSupportedException.class)
	ResponseEntity<ApiError> notJson() {
		return ResponseEntity.status(400).body(new ApiError("JSON 본문이 필요합니다"));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e) {
		return invalid(e.getBindingResult().getFieldErrors().stream().map(FieldError::getField));
	}

	// 경로 값에 제약(@Positive)이 있는 메서드는 본문 검증까지 여기로 온다
	@ExceptionHandler(HandlerMethodValidationException.class)
	ResponseEntity<ApiError> invalid(HandlerMethodValidationException e) {
		return invalid(e.getParameterValidationResults()
			.stream()
			.flatMap((r) -> (r instanceof ParameterErrors errors)
					? errors.getFieldErrors().stream().map(FieldError::getField)
					: Stream.of(r.getMethodParameter().getParameterName())));
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	ResponseEntity<ApiError> invalid(MethodArgumentTypeMismatchException e) {
		return invalid(Stream.of(e.getName()));
	}

	private static ResponseEntity<ApiError> invalid(Stream<String> fields) {
		var names = String.join(", ", fields.distinct().toList());
		return ResponseEntity.status(400).body(new ApiError("입력이 올바르지 않습니다: " + names));
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	ResponseEntity<ApiError> unreadable() {
		return ResponseEntity.status(400).body(new ApiError("JSON 형식이 아닙니다"));
	}

	@ExceptionHandler(NoResourceFoundException.class)
	ResponseEntity<ApiError> notFound() {
		return ResponseEntity.status(404).body(new ApiError("not found"));
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	ResponseEntity<ApiError> methodNotAllowed() {
		return ResponseEntity.status(405).body(new ApiError("method not allowed"));
	}

	// 오류 메시지를 그대로 내보낸다 (밖에 열면 502 는 감추고 로그로)
	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiError> upstream(Exception e) {
		return ResponseEntity.status(502).body(new ApiError(String.valueOf(e.getMessage())));
	}

}
