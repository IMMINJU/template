// templates: 템플릿 CRUD 서버. `go run . gen` 은 openapi 문서만 쓰고 끝난다 (DB 없이).
package main

import (
	"cmp"
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	"templates/api"
	"templates/storage"
)

func main() {
	handler, doc := api.New()
	if len(os.Args) > 1 && os.Args[1] == "gen" {
		// pnpm gen: Huma 가 오퍼레이션에서 만든 문서 → contract/openapi/templates.json. 클라이언트 타입은 이 문서에서 만든다
		b, err := json.MarshalIndent(doc.OpenAPI(), "", "  ")
		if err == nil {
			err = os.WriteFile("../../contract/openapi/templates.json", append(b, '\n'), 0o644)
		}
		if err != nil {
			log.Fatal(err)
		}
		return
	}

	// 개발은 이 맥에서만. 컨테이너 등 밖에 열 때 0.0.0.0 (인증 · TLS 먼저)
	addr := net.JoinHostPort(cmp.Or(os.Getenv("HOST"), "127.0.0.1"), cmp.Or(os.Getenv("PORT"), "8003"))
	// 표를 먼저 맞추고 연다 (실패하면 열지 않고 끝난다)
	if err := storage.Migrate(context.Background()); err != nil {
		log.Fatalf("마이그레이션 실패: %v", err)
	}
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
		// 본문 읽기는 Huma 가 오퍼레이션마다 끊는다 (BodyReadTimeout 기본 5초)
	}
	log.Printf("api http://%s", addr)
	log.Fatal(srv.ListenAndServe())
}
