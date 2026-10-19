# Expo 모바일 앱

메모 앱. Expo SDK 58 (React Native) + TanStack Query. 클라이언트 공통 규칙은 `docs/architecture.md` 의 "클라이언트", 이 파일이 이 앱에서는 우선한다.

## 구조

```
index.ts                 # 진입점 (registerRootComponent)
App.tsx                  # QueryClientProvider 하나 + 메모 화면(태그 칩 · 추가 · 삭제). 색은 시스템 설정(useColorScheme)을 따른다
app.json                 # Expo 설정: 앱 이름 · slug (pnpm rename 이 바꾼다) · 아이콘
assets/                  # 앱 아이콘 (iOS · Android)
package.json · tsconfig.json
```

## 명령

```bash
pnpm start · ios · android · typecheck · lint · format   # expo start (--ios · --android) · tsc -p . (Expo 의 TS 6) · oxlint · oxfmt
CI=1 npx expo export --platform ios --output-dir /tmp/expo-export   # 시뮬레이터 없이 번들까지 확인
```

## 규칙

- 버전은 Expo SDK 가 정한다: `expo` · `expo-status-bar` · `react` · `react-dom` · `react-native` · `@types/react` · `typescript` 는 `catalog:expo`.
  올릴 때는 `npx expo install --fix` 뒤 카탈로그를 맞춘다.
- 서버: notes 하나. `createClient<notes.paths>({ name: 'notes', base })`. `base` 는 `EXPO_PUBLIC_NOTES_URL`(기본 notes `http://127.0.0.1:8000`).
  iOS 시뮬레이터는 맥의 127.0.0.1 로 붙고, Android 에뮬레이터는 `adb reverse tcp:8000 tcp:8000`.
  실제 기기는 notes 를 `HOST=0.0.0.0` 으로 띄우고 `EXPO_PUBLIC_NOTES_URL` 에 맥 IP 의 notes 주소 (인증 먼저).
- Metro 가 워크스페이스 TS 패키지(`@app/client`)를 그대로 읽는다.
- 시뮬레이터는 화면에 뜨므로 사용자가 말할 때만 띄운다.
