package templates

import (
	"reflect"
	"strings"
	"testing"

	"templates/storage"
	"templates/tests/support"
)

// POST /api/templates
func TestPOST(t *testing.T) {
	support.Run(t, "올바른_템플릿을_보내면_201_Created와_만든_템플릿을_반환하고_DB에_저장된다", func(t *testing.T) {
		// Arrange
		body := map[string]any{"name": "회의록", "body": "회의\n할 일", "junk": 1}

		// Act
		res := support.SendJSON(t, "POST", "/api/templates", body)

		// Assert
		if res.Status != 201 {
			t.Fatalf("status = %d, want 201 (%s)", res.Status, res.Body)
		}
		got := support.Decode[storage.Template](t, res) // junk 가 섞여 오면 여기서 실패한다
		want := storage.Template{ID: got.ID, Name: "회의록", Body: "회의\n할 일"}
		if got != want || got.ID < 1 {
			t.Errorf("응답 = %+v, want %+v", got, want)
		}
		if saved := support.Templates(t); !reflect.DeepEqual(saved, []storage.Template{want}) {
			t.Errorf("저장된 템플릿 = %+v, want %+v", saved, want)
		}
	})

	support.Run(t, "대소문자만_다른_키는_모르는_필드로_버리고_검증한_값을_저장한다", func(t *testing.T) {
		// encoding/json 은 키를 대소문자 없이 맞춘다. 그대로 두면 검증을 거치지 않은 Name · BODY 가 name · body 를 덮어쓴다
		res := support.Do(t, "POST", "/api/templates", "application/json", `{"name":"회의록","Name":"","body":"회의","BODY":"x"}`)

		if res.Status != 201 {
			t.Fatalf("status = %d, want 201 (%s)", res.Status, res.Body)
		}
		got := support.Decode[storage.Template](t, res)
		want := storage.Template{ID: got.ID, Name: "회의록", Body: "회의"}
		if got != want {
			t.Errorf("응답 = %+v, want %+v", got, want)
		}
		if saved := support.Templates(t); !reflect.DeepEqual(saved, []storage.Template{want}) {
			t.Errorf("저장된 템플릿 = %+v, want %+v", saved, want)
		}
	})

	support.Run(t, "이름_내용이_문자열이_아니거나_비었거나_너무_길면_400_Bad_Request를_반환하고_저장하지_않는다", func(t *testing.T) {
		for _, body := range []string{
			`null`,
			`[]`,
			`"x"`,
			`{}`,
			`{"name":"회의록"}`,
			`{"Name":"회의록","body":"x"}`,
			`{"name":1,"body":"x"}`,
			`{"name":"회의록","body":1}`,
			`{"name":"","body":"x"}`,
			`{"name":"회의록","body":""}`,
			`{"name":"` + strings.Repeat("x", 51) + `","body":"x"}`,
			`{"name":"회의록","body":"` + strings.Repeat("x", 10_001) + `"}`,
			`{"name":`,
		} {
			res := support.Do(t, "POST", "/api/templates", "application/json", body)

			support.AssertBadRequest(t, res, body[:min(len(body), 40)])
		}
		if saved := support.Templates(t); len(saved) != 0 {
			t.Errorf("저장된 템플릿 = %+v, 없어야 한다", saved)
		}
	})

	support.Run(t, "JSON이_아닌_본문은_400_Bad_Request를_반환하고_저장하지_않는다", func(t *testing.T) {
		res := support.Do(t, "POST", "/api/templates", "application/x-www-form-urlencoded", "name=a&body=b")

		support.AssertError(t, res, 400, "JSON 본문이 필요합니다")
		if saved := support.Templates(t); len(saved) != 0 {
			t.Errorf("저장된 템플릿 = %+v, 없어야 한다", saved)
		}
	})
}
