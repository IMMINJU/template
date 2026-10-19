package id

import (
	"fmt"
	"reflect"
	"strings"
	"testing"

	"templates/storage"
	"templates/tests/support"
)

// PUT /api/templates/{id}
func TestPUT(t *testing.T) {
	support.Run(t, "올바른_템플릿을_보내면_200_OK와_고친_템플릿을_반환하고_DB에_저장된다", func(t *testing.T) {
		// Arrange
		id := support.CreateTemplate(t, "회의록", "회의").ID

		// Act
		res := support.SendJSON(t, "PUT", fmt.Sprintf("/api/templates/%d", id),
			map[string]any{"name": "버그", "body": "버그 재현", "junk": 1})

		// Assert
		if res.Status != 200 {
			t.Fatalf("status = %d, want 200 (%s)", res.Status, res.Body)
		}
		want := storage.Template{ID: id, Name: "버그", Body: "버그 재현"}
		if got := support.Decode[storage.Template](t, res); got != want {
			t.Errorf("응답 = %+v, want %+v", got, want)
		}
		if saved := support.Templates(t); !reflect.DeepEqual(saved, []storage.Template{want}) {
			t.Errorf("저장된 템플릿 = %+v, want %+v", saved, want)
		}
	})

	support.Run(t, "없는_id면_404_Not_Found를_반환한다", func(t *testing.T) {
		id := support.MissingID(t)

		res := support.SendJSON(t, "PUT", fmt.Sprintf("/api/templates/%d", id), map[string]any{"name": "후", "body": "후"})

		support.AssertError(t, res, 404, "템플릿이 없습니다")
		if saved := support.Templates(t); len(saved) != 0 {
			t.Errorf("저장된 템플릿 = %+v, 없어야 한다", saved)
		}
	})

	support.Run(t, "id가_양의_정수가_아니면_400_Bad_Request를_반환한다", func(t *testing.T) {
		for _, id := range []string{"abc", "1.5", "0", "-1"} {
			res := support.SendJSON(t, "PUT", "/api/templates/"+id, map[string]any{"name": "후", "body": "후"})

			support.AssertBadRequest(t, res, id)
		}
	})

	support.Run(t, "이름_내용이_문자열이_아니거나_비었거나_너무_길면_400_Bad_Request를_반환하고_고치지_않는다", func(t *testing.T) {
		before := support.CreateTemplate(t, "전", "전")

		for _, body := range []string{
			`null`,
			`[]`,
			`"x"`,
			`{}`,
			`{"name":1,"body":"x"}`,
			`{"name":"","body":"x"}`,
			`{"name":"` + strings.Repeat("x", 51) + `","body":"x"}`,
			`{"name":"후","body":"` + strings.Repeat("x", 10_001) + `"}`,
		} {
			res := support.Do(t, "PUT", fmt.Sprintf("/api/templates/%d", before.ID), "application/json", body)

			support.AssertBadRequest(t, res, body[:min(len(body), 40)])
		}
		if saved := support.Templates(t); !reflect.DeepEqual(saved, []storage.Template{before}) {
			t.Errorf("저장된 템플릿 = %+v, want %+v", saved, before)
		}
	})

	support.Run(t, "JSON이_아닌_본문은_400_Bad_Request를_반환하고_고치지_않는다", func(t *testing.T) {
		before := support.CreateTemplate(t, "전", "전")

		res := support.Do(t, "PUT", fmt.Sprintf("/api/templates/%d", before.ID), "application/x-www-form-urlencoded", "name=a&body=b")

		support.AssertError(t, res, 400, "JSON 본문이 필요합니다")
		if saved := support.Templates(t); !reflect.DeepEqual(saved, []storage.Template{before}) {
			t.Errorf("저장된 템플릿 = %+v, want %+v", saved, before)
		}
	})
}
