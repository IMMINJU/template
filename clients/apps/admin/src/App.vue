<script setup lang="ts">
import {
  createClient,
  type activity,
  type tags,
  type templates,
} from '@app/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref } from 'vue'

// 같은 출처: vite 프록시가 /api/tags · /api/activity · /api/templates 를 각 서버로 넘긴다
const tagsApi = createClient<tags.paths>({ name: 'tags' })
const activityApi = createClient<activity.paths>({ name: 'activity' })
const templatesApi = createClient<templates.paths>({ name: 'templates' })
const templatesQuery = templatesApi.query('/api/templates')
const rulesQuery = tagsApi.query('/api/tags/rules')

const qc = useQueryClient()
const { data: rules, error: rulesError } = useQuery(rulesQuery)
const { data: log, error: logError } = useQuery(
  activityApi.query('/api/activity'),
)
// 규칙을 바꾸면 목록을 다시 받는다
const onSuccess = () => qc.invalidateQueries({ queryKey: rulesQuery.queryKey })
const add = useMutation({
  mutationFn: (rule: { keyword: string; tag: string }) =>
    tagsApi.post('/api/tags/rules', rule),
  onSuccess,
})
const remove = useMutation({
  mutationFn: (id: number) =>
    tagsApi.delete('/api/tags/rules/{id}', { params: { id } }),
  onSuccess,
})
// 템플릿: 고르면 아래 칸에 불러와 고치고(PUT), 고르지 않았으면 새로 만든다(POST)
const { data: list, error: listError } = useQuery(templatesQuery)
const editing = ref<number>()
const draft = reactive({ name: '', body: '' })
function edit(t: { id: number; name: string; body: string }) {
  editing.value = t.id
  Object.assign(draft, { name: t.name, body: t.body })
}
function clear() {
  editing.value = undefined
  Object.assign(draft, { name: '', body: '' })
}
const refreshTemplates = () =>
  qc.invalidateQueries({ queryKey: templatesQuery.queryKey })
const save = useMutation({
  mutationFn: (id: number | undefined) =>
    id === undefined
      ? templatesApi.post('/api/templates', { ...draft })
      : templatesApi.put(
          '/api/templates/{id}',
          { ...draft },
          { params: { id } },
        ),
  onSuccess: () => {
    clear()
    return refreshTemplates()
  },
})
const removeTemplate = useMutation({
  mutationFn: (id: number) =>
    templatesApi.delete('/api/templates/{id}', { params: { id } }),
  onSuccess: refreshTemplates,
})

const failure = computed(
  () =>
    rulesError.value ??
    logError.value ??
    listError.value ??
    add.error.value ??
    remove.error.value ??
    save.error.value ??
    removeTemplate.error.value,
)

function submit(e: Event) {
  const form = e.currentTarget as HTMLFormElement
  const data = new FormData(form)
  add.mutate(
    { keyword: String(data.get('keyword')), tag: String(data.get('tag')) },
    { onSuccess: () => form.reset() },
  )
}
</script>

<template>
  <main>
    <h1>관리</h1>
    <p v-if="failure" role="alert">{{ failure.message }}</p>
    <section class="card">
      <h2>태그 규칙</h2>
      <ul v-if="rules">
        <li v-for="r in rules.rules" :key="r.id" class="row">
          <span>{{ r.keyword }} →</span>
          <span class="tag">{{ r.tag }}</span>
          <button
            class="danger"
            :disabled="remove.isPending.value"
            @click="remove.mutate(r.id)"
          >
            삭제
          </button>
        </li>
      </ul>
      <p v-else-if="!failure">불러오는 중</p>
      <form @submit.prevent="submit">
        <input
          name="keyword"
          maxlength="100"
          required
          placeholder="키워드"
          aria-label="키워드"
        />
        <input
          name="tag"
          maxlength="30"
          required
          placeholder="태그"
          aria-label="태그"
        />
        <button :disabled="add.isPending.value">추가</button>
      </form>
    </section>
    <section class="card">
      <h2>템플릿</h2>
      <ul v-if="list">
        <li v-for="t in list.templates" :key="t.id" class="row">
          <span>{{ t.name }}</span>
          <span class="actions">
            <button @click="edit(t)">수정</button>
            <button
              class="danger"
              :disabled="removeTemplate.isPending.value"
              @click="removeTemplate.mutate(t.id)"
            >
              삭제
            </button>
          </span>
        </li>
      </ul>
      <p v-else-if="!failure">불러오는 중</p>
      <form @submit.prevent="save.mutate(editing)">
        <input
          v-model="draft.name"
          maxlength="50"
          required
          placeholder="이름"
          aria-label="템플릿 이름"
        />
        <textarea
          v-model="draft.body"
          rows="3"
          maxlength="10000"
          required
          placeholder="본문"
          aria-label="템플릿 본문"
        />
        <button v-if="editing !== undefined" type="button" @click="clear">
          취소
        </button>
        <button :disabled="save.isPending.value">
          {{ editing === undefined ? '추가' : '저장' }}
        </button>
      </form>
    </section>
    <section class="card">
      <h2>활동 기록</h2>
      <ul v-if="log">
        <li v-for="a in log.activities" :key="a.id" class="row">
          <span>{{ a.action }}</span>
          <span>메모 {{ a.noteId }}</span>
          <time :datetime="a.at">{{ new Date(a.at).toLocaleString() }}</time>
        </li>
      </ul>
      <p v-else-if="!failure">불러오는 중</p>
    </section>
  </main>
</template>
