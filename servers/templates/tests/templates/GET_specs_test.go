package templates

import (
	"reflect"
	"strings"
	"testing"

	"templates/storage"
	"templates/tests/support"
)

// GET /api/templates
func TestGET(t *testing.T) {
	support.Run(t, "저장된_템플릿을_id_순서대로_반환한다", func(t *testing.T) {
		// Arrange
		first := support.CreateTemplate(t, "회의록", "회의\n할 일")
		second := support.CreateTemplate(t, "일지", "오늘 한 일")

		// Act
		res := support.Do(t, "GET", "/api/templates", "", "")

		// Assert
		if res.Status != 200 {
			t.Fatalf("status = %d, want 200 (%s)", res.Status, res.Body)
		}
		got := support.Decode[struct{ Templates []storage.Template }](t, res)
		if want := []storage.Template{first, second}; !reflect.DeepEqual(got.Templates, want) {
			t.Errorf("templates = %+v, want %+v", got.Templates, want)
		}
	})

	support.Run(t, "템플릿이_없으면_빈_목록을_반환한다", func(t *testing.T) {
		res := support.Do(t, "GET", "/api/templates", "", "")

		if res.Status != 200 {
			t.Errorf("status = %d, want 200", res.Status)
		}
		// null 이 아니라 [] 다
		if got := strings.TrimSpace(res.Body); got != `{"templates":[]}` {
			t.Errorf("본문 = %s", got)
		}
	})
}
