package id

import (
	"fmt"
	"reflect"
	"testing"

	"templates/storage"
	"templates/tests/support"
)

// DELETE /api/templates/{id}
func TestDELETE(t *testing.T) {
	support.Run(t, "저장된_템플릿을_지우면_204_No_Content를_반환하고_DB에서_지워진다", func(t *testing.T) {
		// Arrange
		gone := support.CreateTemplate(t, "지울 템플릿", "지울 내용")
		other := support.CreateTemplate(t, "남을 템플릿", "남을 내용")

		// Act
		res := support.Do(t, "DELETE", fmt.Sprintf("/api/templates/%d", gone.ID), "", "")

		// Assert
		if res.Status != 204 || res.Body != "" {
			t.Errorf("응답 = %d %q, want 204 빈 본문", res.Status, res.Body)
		}
		if saved := support.Templates(t); !reflect.DeepEqual(saved, []storage.Template{other}) {
			t.Errorf("남은 템플릿 = %+v, want %+v", saved, other)
		}
	})

	support.Run(t, "없는_id면_404_Not_Found를_반환한다", func(t *testing.T) {
		id := support.MissingID(t)

		res := support.Do(t, "DELETE", fmt.Sprintf("/api/templates/%d", id), "", "")

		support.AssertError(t, res, 404, "템플릿이 없습니다")
	})

	support.Run(t, "id가_양의_정수가_아니면_400_Bad_Request를_반환한다", func(t *testing.T) {
		for _, id := range []string{"abc", "1.5", "0", "-1"} {
			res := support.Do(t, "DELETE", "/api/templates/"+id, "", "")

			support.AssertBadRequest(t, res, id)
		}
	})
}
