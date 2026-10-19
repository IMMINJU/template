package support

import "testing"

// 오퍼레이션이 없는 요청도 { "error" } (api/server.go)
func TestRoutes(t *testing.T) {
	Run(t, "없는_경로는_404_Not_Found를_반환한다", func(t *testing.T) {
		for _, path := range []string{"/", "/api/unknown", "/api/templatesx", "/api/templates/1/x"} {
			AssertError(t, Do(t, "GET", path, "", ""), 404, "not found")
		}
	})

	Run(t, "경로는_있고_메서드가_다르면_405_Method_Not_Allowed를_반환한다", func(t *testing.T) {
		AssertError(t, Do(t, "PATCH", "/api/templates", "", ""), 405, "method not allowed")
		AssertError(t, Do(t, "GET", "/api/templates/1", "", ""), 405, "method not allowed")
	})
}
