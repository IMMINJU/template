package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"templates/domain"
)

// 검증 · 문서가 이 타입들에서 나온다. 타입 이름이 스키마 이름이라 이 서버 안에서 유일해야 한다

// Template 은 응답의 템플릿 하나
type Template struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Body string `json:"body"`
}

// TemplateInput 은 만들기 · 고치기 본문. 모르는 필드는 받되 버린다 (server.go 가 additionalProperties 를 비운다)
type TemplateInput struct {
	Name string `json:"name" minLength:"1" maxLength:"50"`
	Body string `json:"body" minLength:"1" maxLength:"10000"`
}

type TemplateList struct {
	Templates []Template `json:"templates" nullable:"false"`
}

type templateBody struct{ Body Template }

func registerTemplates(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listTemplates",
		Method:      http.MethodGet,
		Path:        "/api/templates",
		Responses:   errorResponses(api, 502),
	}, func(ctx context.Context, _ *struct{}) (*struct{ Body TemplateList }, error) {
		ts, err := domain.List(ctx)
		if err != nil {
			return nil, err
		}
		out := &struct{ Body TemplateList }{TemplateList{Templates: make([]Template, len(ts))}}
		for i, t := range ts {
			// storage.Template 과 필드가 같아 변환으로 바꾼다. 달라지면 컴파일이 실패하니 그때 필드를 옮겨 적는다
			out.Body.Templates[i] = Template(t)
		}
		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "createTemplate",
		Method:        http.MethodPost,
		Path:          "/api/templates",
		DefaultStatus: http.StatusCreated,
		MaxBodyBytes:  maxBody,
		Responses:     errorResponses(api, 400, 502),
	}, func(ctx context.Context, in *struct{ Body TemplateInput }) (*templateBody, error) {
		t, err := domain.Create(ctx, in.Body.Name, in.Body.Body)
		if err != nil {
			return nil, err
		}
		return &templateBody{Template(t)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "updateTemplate",
		Method:       http.MethodPut,
		Path:         "/api/templates/{id}",
		MaxBodyBytes: maxBody,
		Responses:    errorResponses(api, 400, 404, 502),
	}, func(ctx context.Context, in *struct {
		ID   int64 `path:"id" minimum:"1"`
		Body TemplateInput
	}) (*templateBody, error) {
		t, err := domain.Update(ctx, in.ID, in.Body.Name, in.Body.Body)
		if err != nil {
			return nil, err
		}
		return &templateBody{Template(t)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteTemplate",
		Method:        http.MethodDelete,
		Path:          "/api/templates/{id}",
		DefaultStatus: http.StatusNoContent,
		Responses:     errorResponses(api, 400, 404, 502),
	}, func(ctx context.Context, in *struct {
		ID int64 `path:"id" minimum:"1"`
	}) (*struct{}, error) {
		return nil, domain.Delete(ctx, in.ID)
	})
}
