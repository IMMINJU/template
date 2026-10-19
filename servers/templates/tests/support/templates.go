package support

import (
	"context"
	"testing"

	"templates/storage"
)

// 준비 · 저장 상태 확인은 저장소 함수로 한다 (테스트에 SQL 을 다시 쓰지 않는다). 오류는 테스트 실패로

// CreateTemplate 은 storage.Create
func CreateTemplate(t *testing.T, name, body string) storage.Template {
	t.Helper()
	tpl, err := storage.Create(context.Background(), name, body)
	if err != nil {
		t.Fatal(err)
	}
	return tpl
}

// Templates 는 storage.List (저장된 전부, id 순)
func Templates(t *testing.T) []storage.Template {
	t.Helper()
	ts, err := storage.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return ts
}

// MissingID 는 만들었다 지운 템플릿의 id (없는 id)
func MissingID(t *testing.T) int64 {
	t.Helper()
	id := CreateTemplate(t, "지울 템플릿", "지울 내용").ID
	if _, err := storage.Delete(context.Background(), id); err != nil {
		t.Fatal(err)
	}
	return id
}
