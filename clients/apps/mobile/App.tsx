import { createClient, type notes } from '@app/client'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'

// 서버 기본 바인딩이 127.0.0.1 이라 시뮬레이터에서 붙는다. Android 에뮬레이터는 `adb reverse tcp:8000 tcp:8000`.
// 실제 기기는 notes 를 HOST=0.0.0.0 으로 띄우고 EXPO_PUBLIC_NOTES_URL 에 맥 IP 의 notes 주소 (인증 먼저)
const api = createClient<notes.paths>({
  name: 'notes',
  base: process.env.EXPO_PUBLIC_NOTES_URL ?? 'http://127.0.0.1:8000',
})
const notesQuery = api.query('/api/notes')
const queryClient = new QueryClient()

// DESIGN.md 의 색 토큰 (다크는 -dark)
const light = {
  page: '#F2F2F7',
  surface: '#FFFFFF',
  ink: '#1D1D1F',
  fill: 'rgba(118, 118, 128, 0.12)',
  primary: '#007AFF',
  danger: '#FF3B30',
  // warning-container: color-mix(#FF9500 14%, #FFFFFF)
  warn: '#FFF0DB',
}
const dark: typeof light = {
  page: '#000000',
  surface: '#1C1C1E',
  ink: '#F5F5F7',
  fill: 'rgba(118, 118, 128, 0.24)',
  primary: '#0A84FF',
  danger: '#FF453A',
  // color-mix(#FF9F0A 14%, #1C1C1E)
  warn: '#3C2E1B',
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Notes />
      <StatusBar style="auto" />
    </QueryClientProvider>
  )
}

function Notes() {
  const qc = useQueryClient()
  const { data, error } = useQuery(notesQuery)
  const [text, setText] = useState('')
  // 쓰고 나면 목록을 다시 받는다
  const onSuccess = () =>
    qc.invalidateQueries({ queryKey: notesQuery.queryKey })
  const add = useMutation({
    mutationFn: (t: string) => api.post('/api/notes', { text: t }),
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (id: number) =>
      api.delete('/api/notes/{id}', { params: { id } }),
    onSuccess,
  })
  const failure = error ?? add.error ?? remove.error
  const c = useColorScheme() === 'dark' ? dark : light
  const ink = { color: c.ink }
  // 라이트에서만 옅은 그림자, 다크는 면의 톤으로만
  const card = [
    styles.card,
    { backgroundColor: c.surface },
    c === light && styles.shadow,
  ]
  const button = (off: boolean) => [
    styles.button,
    { backgroundColor: c.fill },
    off && styles.off,
  ]

  return (
    <ScrollView
      style={{ backgroundColor: c.page }}
      contentContainerStyle={styles.page}
      // 키보드가 떠 있어도 추가 버튼이 한 번에 눌리게
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, ink]}>메모</Text>
      {failure ? (
        <Text
          accessibilityRole="alert"
          style={[styles.alert, ink, { backgroundColor: c.warn }]}
        >
          {failure.message}
        </Text>
      ) : null}
      {data
        ? data.notes.map((n) => (
            <View key={n.id} style={[card, styles.note]}>
              <Text style={[styles.text, ink]}>{n.text}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={remove.isPending}
                onPress={() => remove.mutate(n.id)}
                style={button(remove.isPending)}
              >
                <Text style={[styles.label, { color: c.danger }]}>삭제</Text>
              </Pressable>
              {n.tags.length > 0 && (
                <View style={styles.tags}>
                  {n.tags.map((t) => (
                    <Text
                      key={t}
                      style={[styles.tag, ink, { backgroundColor: c.fill }]}
                    >
                      {t}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))
        : !failure && <Text style={ink}>불러오는 중</Text>}
      <View style={[card, styles.add]}>
        <TextInput
          accessibilityLabel="새 메모"
          style={[styles.input, ink, { backgroundColor: c.fill }]}
          multiline
          maxLength={10000}
          value={text}
          onChangeText={setText}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!text || add.isPending}
          onPress={() => add.mutate(text, { onSuccess: () => setText('') })}
          style={[button(!text || add.isPending), styles.end]}
        >
          <Text style={[styles.label, { color: c.primary }]}>추가</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 72, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { borderRadius: 18, padding: 20 },
  shadow: {
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04)',
  },
  // 왼쪽 본문 · 오른쪽 삭제, 태그는 다음 줄 전체
  note: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    rowGap: 8,
    columnGap: 12,
  },
  text: { flex: 1, fontSize: 16 },
  tags: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: {
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  add: { gap: 12 },
  input: {
    minHeight: 96,
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  end: { alignSelf: 'flex-end' },
  off: { opacity: 0.4 },
  label: { fontSize: 16 },
  alert: { padding: 12, borderRadius: 12, overflow: 'hidden' },
})
