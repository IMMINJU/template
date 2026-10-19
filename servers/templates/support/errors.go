// Package support 는 레이어와 무관한 것: 오류 형식.
package support

import "net/http"

// Error 는 모든 서버 공통 오류 형식 { "error": "..." }. 상태 코드는 본문에 넣지 않는다.
// Huma 는 GetStatus 로 상태 코드를, ContentType 으로 응답 헤더를 정한다 (api/errors.go 가 Huma 의 기본 오류 대신 이것을 쓴다)
type Error struct {
	Status  int    `json:"-"`
	Message string `json:"error"`
}

func (e *Error) Error() string               { return e.Message }
func (e *Error) GetStatus() int              { return e.Status }
func (e *Error) ContentType(_ string) string { return "application/json; charset=utf-8" }

// NotFound 는 404. domain 이 없는 자원에 돌려준다
func NotFound(msg string) error { return &Error{Status: http.StatusNotFound, Message: msg} }
