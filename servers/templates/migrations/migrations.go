// Package migrations 는 표를 바꾸는 SQL (goose). 바이너리에 넣어 storage.Migrate 가 적용한다.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
