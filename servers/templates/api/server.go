// Package api 는 HTTP: Huma 오퍼레이션 · 요청 · 응답 타입 · 오류 변환. openapi 문서도 여기서 나온다 (main.go 의 gen).
package api

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
)

// 본문 상한 (notes 와 같게). 넘으면 400
const maxBody = 256_000

// New 는 HTTP 핸들러와 그 문서(huma.API 의 OpenAPI)를 만든다. DB 에 붙지 않는다 (gen 이 DB 없이 문서만 쓴다)
func New() (http.Handler, huma.API) {
	mux := http.NewServeMux()
	config := huma.DefaultConfig("templates", "0.0.0")
	// 문서 · 스키마는 서버가 내주지 않고 pnpm gen 이 파일로 쓴다. 응답에 $schema · Link 를 넣는 기본 훅도 뺀다
	config.OpenAPIPath, config.DocsPath, config.SchemasPath, config.CreateHooks = "", "", "", nil
	// 키 이름은 검증 · 구조체에 넣기 둘 다 정확히 맞춘다 (다른 서버의 zod · pydantic 처럼 Name 은 name 이 아니다).
	// Huma 는 둘 다 encoding/json 처럼 대소문자 없이 맞추는 게 기본이라, 한쪽만 바꾸면 검증한 값과 저장하는 값이 갈린다.
	// huma.DefaultFormats 는 전역이라 고치지 않고 새 맵을 둔다
	huma.ValidateStrictCasing = true
	jsonFormat := huma.Format{Marshal: huma.DefaultJSONFormat.Marshal, Unmarshal: exactJSON}
	config.Formats = map[string]huma.Format{"application/json": jsonFormat, "json": jsonFormat}
	api := humago.New(mux, config)
	api.UseMiddleware(jsonOnly(api))
	registerTemplates(api)
	// 본문의 모르는 필드는 받고 버린다 (struct 에 없으니 빠진다). Huma 는 struct 스키마마다 additionalProperties: false 로 거절하니 비운다.
	// true 로 적지 않는 것은 문서에서 클라이언트 타입에 [key: string]: unknown 이 붙기 때문 (비우면 tags 문서처럼 적지 않는다)
	for _, s := range api.OpenAPI().Components.Schemas.Map() {
		s.AdditionalProperties = nil
	}

	// 오퍼레이션이 없는 요청도 { "error" }: 경로는 있고 메서드가 없으면 405, 그 밖은 404.
	// ServeMux 는 메서드가 붙은 패턴(Huma 의 "GET /api/templates")을 메서드 없는 같은 경로보다 먼저 고른다
	for path := range api.OpenAPI().Paths {
		mux.HandleFunc(path, func(w http.ResponseWriter, _ *http.Request) {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		})
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})
	return mux, api
}

// exactJSON 은 본문을 구조체에 넣을 때 json 이름이 똑같은 키만 쓴다 (이름이 다른 키는 모르는 필드로 버린다).
// encoding/json 은 대소문자 없이 맞춰서, 그대로 두면 {"name":"ok","Name":""} 의 Name 이 검증한 name 을 덮어쓴다
func exactJSON(data []byte, v any) error {
	t := reflect.TypeOf(v)
	var raw map[string]json.RawMessage
	if t == nil || t.Kind() != reflect.Pointer || t.Elem().Kind() != reflect.Struct || json.Unmarshal(data, &raw) != nil {
		return json.Unmarshal(data, v) // 검증용 any · 객체가 아닌 본문은 그대로 (오류도 그대로)
	}
	known := map[string]bool{}
	for i := range t.Elem().NumField() {
		f := t.Elem().Field(i)
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "" {
			name = f.Name
		}
		known[name] = true
	}
	for k := range raw {
		if !known[k] {
			delete(raw, k)
		}
	}
	b, err := json.Marshal(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}
