---
version: alpha
name: iStack
description: 조용하고 단정한 화면. 시스템 색 · 시스템 글꼴, 라이트 · 다크 둘 다
colors:
  primary: "#007AFF"
  primary-dark: "#0A84FF"
  background: "#F2F2F7"
  background-dark: "#000000"
  surface: "#FFFFFF"
  surface-dark: "#1C1C1E"
  on-surface: "#1D1D1F"
  on-surface-dark: "#F5F5F7"
  fill: "rgba(118, 118, 128, 0.12)"
  fill-dark: "rgba(118, 118, 128, 0.24)"
  danger: "#FF3B30"
  danger-dark: "#FF453A"
  warning-container: "color-mix(in srgb, #FF9500 14%, #FFFFFF)"
  warning-container-dark: "color-mix(in srgb, #FF9F0A 14%, #1C1C1E)"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Apple SD Gothic Neo', system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: -0.025em
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Apple SD Gothic Neo', system-ui, sans-serif"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: -0.02em
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Apple SD Gothic Neo', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: -0.01em
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Apple SD Gothic Neo', system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.45
  body-mobile:
    fontFamily: "-apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.45
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  page-max: 1440px
rounded:
  sm: 8px
  md: 12px
  lg: 18px
components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
  page-dark:
    backgroundColor: "{colors.background-dark}"
    textColor: "{colors.on-surface-dark}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 20px
  card-dark:
    backgroundColor: "{colors.surface-dark}"
  input:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  input-dark:
    backgroundColor: "{colors.fill-dark}"
    textColor: "{colors.on-surface-dark}"
  button:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  button-dark:
    backgroundColor: "{colors.fill-dark}"
    textColor: "{colors.primary-dark}"
  button-danger:
    textColor: "{colors.danger}"
  button-danger-dark:
    textColor: "{colors.danger-dark}"
  tag:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.on-surface}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  tag-dark:
    backgroundColor: "{colors.fill-dark}"
    textColor: "{colors.on-surface-dark}"
  alert:
    backgroundColor: "{colors.warning-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  alert-dark:
    backgroundColor: "{colors.warning-container-dark}"
    textColor: "{colors.on-surface-dark}"
  header:
    backgroundColor: "color-mix(in srgb, #F2F2F7 72%, transparent)"
    padding: "{spacing.xl}"
  header-dark:
    backgroundColor: "color-mix(in srgb, #000000 72%, transparent)"
  link:
    textColor: "{colors.primary}"
  link-dark:
    textColor: "{colors.primary-dark}"
---

# iStack 디자인

모든 클라이언트 앱(web · admin · site · lite · mobile · desktop)이 따르는 화면 규칙이다. 값은 위 토큰이 기준이고, 아래 글은 그 값을 언제 쓰는지다.
이름 끝의 `-dark` 는 다크 모드 값이다 (`prefers-color-scheme: dark`, React Native 는 `useColorScheme`). 컴포넌트의 `-dark` 는 바뀌는 값만 적는다.

## Overview

조용하고 단정하다. 내용이 주인공이라 꾸밈은 내용을 가리지 않을 만큼만 둔다.
화면만 봐도 아는 것에는 설명 문구를 달지 않고, 출처 · 가정처럼 정직하게 밝혀야 할 것만 짧게 쓴다.
라이트 · 다크를 모두 지원하고, 둘 다 같은 정성으로 맞춘다.

## Colors

색은 시스템 색과 그룹 배경만 쓴다. 새 색이 필요하면 시스템 색에서 고르고 여기 토큰으로 더한다.

- **Primary:** 누를 수 있는 것에만. 링크 · 주 버튼 · 선택 표시.
- **Background (그룹 배경):** 페이지 바탕. 그 위에 surface 카드가 뜬다.
- **Surface:** 카드 · 시트처럼 내용을 담는 면.
- **On-surface:** 본문 글자. 보조 글자는 같은 색의 투명도로 만든다 (새 회색을 만들지 않는다).
- **Fill:** 입력칸 · 버튼처럼 테두리 없이 구분되는 칸.
- **Danger:** 삭제처럼 되돌릴 수 없는 조작의 글자에만.
- **Warning container:** 오류 · 실패 알림의 면. 주황(#FF9500 · 다크 #FF9F0A)을 surface 에 14% 만 섞는다 (글자는 on-surface).

## Typography

시스템 글꼴 하나를 무게와 크기로만 나눈다. 웹 글꼴은 불러오지 않는다.

- **Title (22px · 700):** 화면 제목, 한 화면에 하나.
- **Headline (17px · 600):** 카드 · 구역 제목.
- **Body (14px):** 본문 · 입력. 자간을 살짝 좁혀(-0.01em) 시스템 앱과 같은 밀도를 낸다.
- **Caption (12px · 500):** 태그처럼 내용에 붙는 짧은 표시.
- **Body-mobile (16px):** 모바일 입력칸. 16px 보다 작으면 iOS 가 입력할 때 화면을 확대한다.

## Layout

카드를 세로로 쌓는 단일 열이 기본이다. 내용 폭은 `page-max` 까지.
간격은 4px 단위: 요소 사이 `md`(12), 카드 사이 `lg`(16), 페이지 가장자리 `xl`(24).

## Elevation & Depth

깊이는 그림자보다 면의 톤으로 낸다: background → surface.
라이트에서만 카드에 아주 옅은 그림자(`0 1px 2px` · `0 4px 16px`, 검정 4%)를 두고, 다크에서는 그림자 없이 톤 차이로만.
스크롤해도 남는 머리글은 background 를 72% 만 칠하고 뒤를 흐리게 비춘다(`saturate(180%) blur(20px)`).

## Shapes

테두리선 없이 둥근 면으로 나눈다. 큰 면일수록 더 둥글게: 입력칸 `sm`(8) · 알림 `md`(12) · 카드 `lg`(18).

## Components

- **Page:** background 바탕에 on-surface 본문.
- **Card:** surface 면, 테두리 없음, 안쪽 20px. 한 카드에는 한 가지 일만 담는다.
- **Input:** fill 칸, 테두리 없음. 포커스는 글자색 30% 의 3px 바깥선(`:focus-visible`).
  모바일은 손가락으로 누르므로 안쪽 · 둥글기를 `md`(12)로 키운다.
- **Button:** fill 칸에 primary 글자, 테두리 없음. 안쪽은 위아래 `sm`(8) · 좌우 `md`(12). 삭제처럼 되돌릴 수 없는 것은 글자만 danger.
  요청이 끝나기 전에는 막고 40% 로 흐린다. 모바일은 손가락으로 누르므로 위아래도 `md`(12), 글자는 body-mobile.
- **Tag:** fill 칸에 on-surface 글자(caption), 테두리 없음. 안쪽은 위아래 `xs`(4) · 좌우 `sm`(8), 칩 사이도 `xs`(4).
  누를 수 없으니 primary 를 쓰지 않는다. 내용 아래에 줄을 바꿔 가며 늘어놓고, 태그가 없으면 칸도 두지 않는다.
- **Alert:** warning container 면에 on-surface 글자. 오류 내용을 그대로 보여 준다 (`role="alert"`).
- **Header:** 화면 제목과 그 화면 전체에 걸리는 조작만. 반투명 · 흐림으로 스크롤 위에 뜬다.
- **Link:** primary 글자, 밑줄 없이. 누를 수 있는 글자에만 primary 를 쓴다.

## Do's and Don'ts

- **Do:** 같은 정보 · 조작은 한 곳에만 둔다.
- **Do:** 새 값이 필요하면 먼저 이 파일의 토큰을 더하고 코드에서 그 값을 쓴다.
- **Do:** 라이트 · 다크를 둘 다 띄워 확인한다 (`verify-local` skill).
- **Don't:** 장식용 색 · 그라디언트 · 테두리선 · 진한 그림자를 쓰지 않는다.
- **Don't:** 화면만 봐도 아는 설명 문구, 같은 내용을 되풀이하는 제목 · 안내를 달지 않는다.
- **Don't:** 시스템 글꼴 밖의 글꼴, 토큰에 없는 크기 · 간격 · 둥글기를 쓰지 않는다.
