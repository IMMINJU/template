package storage

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// Template 은 templates 표의 한 행. 필드만 있는 값이라 레이어를 넘겨 써도 된다 (api 가 응답 타입으로 바꾼다)
type Template struct {
	ID   int64
	Name string
	Body string
}

func query(ctx context.Context, sql string, args ...any) ([]Template, error) {
	pool, err := DB()
	if err != nil {
		return nil, err
	}
	rows, _ := pool.Query(ctx, sql, args...)
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Template])
}

// first 는 첫 행. 없으면 nil (Update · Delete)
func first(ctx context.Context, sql string, args ...any) (*Template, error) {
	rows, err := query(ctx, sql, args...)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

func List(ctx context.Context) ([]Template, error) {
	return query(ctx, `SELECT id, name, body FROM templates ORDER BY id`)
}

func Create(ctx context.Context, name, body string) (Template, error) {
	rows, err := query(ctx, `INSERT INTO templates (name, body) VALUES ($1, $2) RETURNING id, name, body`, name, body)
	if err != nil {
		return Template{}, err
	}
	return rows[0], nil
}

func Update(ctx context.Context, id int64, name, body string) (*Template, error) {
	return first(ctx, `UPDATE templates SET name = $2, body = $3 WHERE id = $1 RETURNING id, name, body`, id, name, body)
}

func Delete(ctx context.Context, id int64) (*Template, error) {
	return first(ctx, `DELETE FROM templates WHERE id = $1 RETURNING id, name, body`, id)
}
