// Package support 는 모든 API 테스트의 공통 설정. 처음 쓸 때 이 테스트 프로세스(= go test 의 패키지 하나)에서:
//   - 테스트 DB(templates_test, `pnpm infra` 의 Postgres)에 마이그레이션을 한 번 적용한다 (Postgres 가 없으면 바로 멈춘다)
//   - 실제 핸들러(api.New)를 랜덤 포트로 띄운다 (httptest)
//
// 테스트는 Run 으로 돌리고, Run 이 테스트마다 앞뒤로 DB 를 비운다. 패키지끼리 서버는 따로지만 DB 는 같이 쓰므로
// 패키지를 하나씩 돌리고(go test -p 1) t.Parallel 은 쓰지 않는다.
package support

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"templates/api"
	"templates/storage"
)

var base = sync.OnceValue(func() string {
	os.Setenv("PGDATABASE", "templates_test")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := storage.Migrate(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "Postgres 에 붙지 못했다. 저장소 루트에서 pnpm infra 를 먼저 띄운다: %v\n", err)
		os.Exit(1)
	}
	handler, _ := api.New()
	return httptest.NewServer(handler).URL
})

// Run 은 t.Run 처럼 테스트 하나를 돌리고, 그 앞뒤로 DB 를 비운다
func Run(t *testing.T, name string, f func(t *testing.T)) {
	t.Run(name, func(t *testing.T) {
		base()
		reset(t)
		t.Cleanup(func() { reset(t) })
		f(t)
	})
}

// reset 은 마이그레이션 기록(goose_db_version)을 뺀 모든 표를 비운다. id(IDENTITY)는 되돌리지 않으니 테스트는 돌려받은 id 를 쓴다
func reset(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	pool, err := storage.DB()
	if err != nil {
		t.Fatal(err)
	}
	rows, _ := pool.Query(ctx, `SELECT tablename FROM pg_tables
		WHERE schemaname = current_schema() AND tablename <> 'goose_db_version'`)
	tables, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	for i, name := range tables {
		tables[i] = pgx.Identifier{name}.Sanitize()
	}
	if len(tables) > 0 {
		if _, err := pool.Exec(ctx, "TRUNCATE "+strings.Join(tables, ", ")); err != nil {
			t.Fatal(err)
		}
	}
}

type Response struct {
	Status int
	Header http.Header
	Body   string
}

// Do 는 실제 HTTP 요청. contentType 이 비었으면 Content-Type 을 보내지 않는다
func Do(t *testing.T, method, path, contentType, body string) Response {
	t.Helper()
	req, err := http.NewRequest(method, base()+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	return Response{res.StatusCode, res.Header, string(b)}
}

// SendJSON 은 JSON 본문 POST · PUT
func SendJSON(t *testing.T, method, path string, body any) Response {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	return Do(t, method, path, "application/json", string(b))
}

// Decode 는 응답 본문을 T 로 읽는다. T 에 없는 필드가 오면 실패한다 (버려야 할 필드가 응답에 섞이지 않았는지).
// encoding/json 은 필드 이름을 대소문자 없이 맞추니 storage.Template 으로 바로 읽는다 (id → ID)
func Decode[T any](t *testing.T, res Response) T {
	t.Helper()
	var v T
	dec := json.NewDecoder(strings.NewReader(res.Body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&v); err != nil {
		t.Fatalf("본문을 읽지 못했다: %v: %q", err, res.Body)
	}
	return v
}

// AssertError 는 오류 응답을 JSON 필드로 비교한다: 상태 코드 · Content-Type · { "error": msg }
func AssertError(t *testing.T, res Response, status int, msg string) {
	t.Helper()
	if got := errorOf(t, res, status); got != msg {
		t.Errorf("error = %q, want %q", got, msg)
	}
}

// AssertBadRequest 는 400 { "error": 메시지 } 인지만 본다 (메시지는 검증기가 정한다). label 은 실패할 때 어느 입력인지
func AssertBadRequest(t *testing.T, res Response, label string) {
	t.Helper()
	if res.Status != http.StatusBadRequest {
		t.Errorf("%s: status = %d, want 400 (%s)", label, res.Status, res.Body)
		return
	}
	if errorOf(t, res, http.StatusBadRequest) == "" {
		t.Errorf("%s: error 가 비었다", label)
	}
}

func errorOf(t *testing.T, res Response, status int) string {
	t.Helper()
	if res.Status != status {
		t.Errorf("status = %d, want %d", res.Status, status)
	}
	if ct := res.Header.Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Errorf("Content-Type = %q", ct)
	}
	got := Decode[map[string]string](t, res)
	if _, ok := got["error"]; !ok || len(got) != 1 {
		t.Errorf("본문 = %v, { error } 하나여야 한다", got)
	}
	return got["error"]
}
