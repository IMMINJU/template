// Package domain 은 업무 로직 (HTTP 와 무관). 지금은 storage 로 넘기기만 하지만 레이어라서 둔다.
package domain

import (
	"context"

	"templates/storage"
	"templates/support"
)

var errNotFound = support.NotFound("템플릿이 없습니다")

func List(ctx context.Context) ([]storage.Template, error) {
	return storage.List(ctx)
}

func Create(ctx context.Context, name, body string) (storage.Template, error) {
	return storage.Create(ctx, name, body)
}

func Update(ctx context.Context, id int64, name, body string) (storage.Template, error) {
	t, err := storage.Update(ctx, id, name, body)
	if err == nil && t == nil {
		err = errNotFound
	}
	if err != nil {
		return storage.Template{}, err
	}
	return *t, nil
}

func Delete(ctx context.Context, id int64) error {
	t, err := storage.Delete(ctx, id)
	if err == nil && t == nil {
		return errNotFound
	}
	return err
}
