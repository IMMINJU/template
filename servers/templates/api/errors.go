package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"templates/support"
)

// Huma 가 만드는 오류(검증 실패 · 본문 읽기 실패 · 핸들러가 돌려준 일반 오류)를 공통 형식 { "error" } 로.
// 잘못된 입력은 400 (Huma 기본 422 · 413 · 415 아님), 없음 404 · 다른 메서드 405 는 그대로, 그 외는 502 (기본 500 아님).
// domain 이 돌려준 *support.Error(404)는 상태 코드를 가지고 있어 Huma 가 그대로 쓴다
func init() {
	huma.NewError = func(status int, msg string, errs ...error) huma.StatusError {
		switch {
		case status == http.StatusNotFound || status == http.StatusMethodNotAllowed:
		case status >= 400 && status < 500:
			status = http.StatusBadRequest
		default:
			status = http.StatusBadGateway
		}
		return &support.Error{Status: status, Message: message(status, msg, errs)}
	}
}

// message 는 오류 메시지. 검증 실패면 어느 입력인지(body.name · path.id)와 Huma 의 설명, 핸들러 오류면 그 메시지 그대로
// (밖에 열면 502 는 감추고 로그로). 받은 값은 다시 내보내지 않는다 (긴 본문이 그대로 돌아온다)
func message(status int, msg string, errs []error) string {
	var parts []string
	for _, err := range errs {
		var d *huma.ErrorDetail
		switch {
		case err == nil:
		case errors.As(err, &d):
			parts = append(parts, d.Location+": "+d.Message)
		default:
			parts = append(parts, err.Error())
		}
	}
	switch {
	case len(parts) == 0:
		return msg
	case status == http.StatusBadRequest:
		return "입력이 올바르지 않습니다: " + strings.Join(parts, ", ")
	default:
		return strings.Join(parts, ", ")
	}
}

// jsonOnly 는 본문이 있는 오퍼레이션(POST · PUT)에 JSON 본문만 받는다 (form 같은 단순 요청은 다른 사이트에서 몰래 보낼 수 있다)
func jsonOnly(api huma.API) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		if ctx.Operation().RequestBody != nil && !strings.HasPrefix(ctx.Header("Content-Type"), "application/json") {
			huma.WriteErr(api, ctx, http.StatusBadRequest, "JSON 본문이 필요합니다")
			return
		}
		next(ctx)
	}
}

// errorResponses 는 문서의 오류 응답: 실제로 내는 상태 코드와 { "error" } 스키마만.
// Operation.Errors 를 쓰면 Huma 가 422 · 500 을 덧붙이니 Responses 에 직접 적는다
func errorResponses(api huma.API, codes ...int) map[string]*huma.Response {
	schema := api.OpenAPI().Components.Schemas.Schema(reflect.TypeFor[support.Error](), true, "")
	out := map[string]*huma.Response{}
	for _, code := range codes {
		out[strconv.Itoa(code)] = &huma.Response{
			Description: http.StatusText(code),
			Content:     map[string]*huma.MediaType{"application/json": {Schema: schema}},
		}
	}
	return out
}

// writeError 는 Huma 밖(오퍼레이션이 없는 경로 · 메서드)에서 같은 형식으로 답한다
func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(&support.Error{Message: msg})
}
