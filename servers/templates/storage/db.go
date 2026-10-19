// Package storage 는 Postgres (docker/docker-compose.middleware.yaml, `pnpm infra`) 의 표를 읽고 쓴다.
package storage

import (
	"cmp"
	"context"
	"net"
	"net/url"
	"os"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"templates/migrations"
)

// connString 은 PG* 환경 변수 (기본 docker 의 templates DB). 부를 때 읽는다 (테스트가 PGDATABASE 를 바꾼다)
func connString() string {
	return (&url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(cmp.Or(os.Getenv("PGUSER"), "app"), cmp.Or(os.Getenv("PGPASSWORD"), "app")),
		Host:   net.JoinHostPort(cmp.Or(os.Getenv("PGHOST"), "127.0.0.1"), cmp.Or(os.Getenv("PGPORT"), "5432")),
		Path:   cmp.Or(os.Getenv("PGDATABASE"), "templates"),
	}).String()
}

// DB 는 연결 풀. 처음 부를 때 연결 정보를 읽어 만들고, 연결은 처음 쿼리할 때 맺는다
var DB = sync.OnceValues(func() (*pgxpool.Pool, error) {
	return pgxpool.New(context.Background(), connString())
})

// Migrate 는 migrations/ 의 SQL 중 아직 안 한 것을 순서대로 적용한다 (한 것은 goose_db_version 표). 서버 · 테스트가 listen 전에 부른다
func Migrate(ctx context.Context) error {
	pool, err := DB()
	if err != nil {
		return err
	}
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()
	p, err := goose.NewProvider(goose.DialectPostgres, db, migrations.FS)
	if err != nil {
		return err
	}
	_, err = p.Up(ctx)
	return err
}
