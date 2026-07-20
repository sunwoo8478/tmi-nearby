# Contributing

이 저장소는 포트폴리오용 프론트엔드 프로토타입입니다. 변경할 때는 화면 완성도와 모바일 사용성을 우선합니다.

## 작업 기준

- 모바일 뷰에서 먼저 확인합니다.
- 색상과 간격은 `src/styles.css`의 CSS 변수와 기존 패턴을 우선 사용합니다.
- 기능을 추가할 때는 `src/app.js`의 UI 흐름과 `src/data.js`의 mock data 구조를 깨지 않게 유지합니다.
- 순수 로직은 가능하면 `src/geo.js`, `src/utils.js`처럼 별도 모듈로 분리하고 테스트를 같이 추가합니다.

## 순수 검증/유효성 로직 분리 가이드

검증·유효성·계산 등 DOM이나 `localStorage`에 의존하지 않는 순수 로직은 `src/utils.js`에 `export` 함수로 추가하고, `src/utils.test.mjs`에 단위 테스트를 함께 작성합니다. `src/app.js`에서는 해당 함수를 import해 호출만 담당하고, 상수(예: 금지어 목록, 전화번호 정규식, 쿨다운 시간)는 인자로 주입해 테스트 격리성을 유지합니다.

### 최근 적용 사례

`c47eb98 refactor: 글쓰기 검증 로직을 utils.js 순수 함수로 분리`에서 아래 함수들을 `src/app.js`의 인라인 검증에서 `src/utils.js`로 옮겼습니다.

| 함수 | 역할 | app.js에서 주입하는 인자 |
| --- | --- | --- |
| `getComposeCooldownRemainingMs(lastComposeTime, now, cooldownMs)` | 중복 작성 방지 쿨다운 잔여 시간(ms) 반환, 0이면 허용 | `lastComposeTime`, `Date.now()`, `COMPOSE_COOLDOWN_MS` |
| `containsBadWord(text, badWords)` | 금지어 포함 여부 | 작성/댓글 텍스트, `BAD_WORDS` 배열 |
| `containsPhoneNumber(text, phonePattern)` | 전화번호 패턴 포함 여부 | 텍스트, `PHONE_PATTERN` 정규식 |
| `containsLocationHint(text)` | 동/호수/아파트/단지/빌딩처럼 위치를 특정할 수 있는 표현 포함 여부 | 작성/댓글 텍스트 |
| `getCommentReportId(postId, commentIndex)` | 댓글 신고 중복 방지용 로컬 식별자 생성 | 게시물 ID, 댓글 index |

이 패턴을 따르면:
- `node --test`로 브라우저 환경 없이 검증 로직만 단독 테스트 가능합니다.
- 상수를 인자로 주입하므로 테스트에서 임의 값/엣지 케이스를 자유롭게 검증할 수 있습니다.
- `src/app.js`는 UI 부작용(토스트, 필드 초기화 등)만 남기고 검증 조건은 utils에 위임합니다.

새 검증 로직을 추가할 때도 같은 흐름을 따라주세요: 1) `src/utils.js`에 JSDoc과 함께 export 함수 작성, 2) `src/utils.test.mjs`에 케이스 추가, 3) `src/app.js`에서 import해 사용.

## 프로젝트 구조

| 파일 | 역할 |
| --- | --- |
| `src/app.js` | 화면 렌더링, 사용자 인터랙션, localStorage 영속화(작성 글/숨김/차단/신고/투표/알림닫기/닉네임 9개 키) |
| `src/data.js` | mock 게시물, 알림, 내 글 데이터 |
| `src/geo.js` | 위치, 거리 계산 유틸리티 |
| `src/utils.js` | DOM과 분리 가능한 공용 순수 함수(XSS 방지, 쿨다운, 민감어/전화번호/위치 힌트 필터, 댓글 신고 식별자 등) |
| `src/styles.css` | 다크 글래스 무드, 라임 포인트, safe-area, 바텀시트 등 전체 스타일과 CSS 변수 |
| `src/*.test.mjs` | `node:test` 기반 유틸리티/데이터 shape 단위 테스트 |
| `e2e/*.spec.js` | Playwright 기반 브라우저 E2E 테스트 (`src/app.js`의 DOM/localStorage 흐름 검증) |
| `server/` | `docs/BACKEND.md` API를 실제 구현한 백엔드 후보 서버 (Node 내장 http + node:sqlite, 프론트와 미연동) |

## E2E 테스트 (Playwright)

`src/app.js`는 DOM에 강하게 의존해서 `node:test` 단위 테스트로 커버할 수 없습니다. 대신 `e2e/smoke.spec.js`가 실제 브라우저를 띄워서 차단/숨김/투표/알림닫기 등의 새로고침 영속성, 드래그 스와이프, 댓글 작성 흐름을 검증합니다. 이 저장소의 유일한 npm 의존성(`@playwright/test`)이며, 순수 프론트엔드 코드 자체에는 여전히 새 의존성을 추가하지 않습니다.

```bash
npx playwright install chromium   # 최초 1회
npm run test:e2e
```

새 UI 흐름을 추가하거나 기존 흐름의 상태 관리(특히 localStorage 영속화)를 바꿀 때는 `e2e/smoke.spec.js`에 시나리오를 추가하거나 갱신해주세요.

## 백엔드 후보 서버 (`server/`)

`docs/BACKEND.md`에 설계로만 있던 API를 `server/`에 실제로 구현했습니다. 새 npm 의존성 없이 Node 내장 `http`와 `node:sqlite`(`DatabaseSync`)만 사용하고, SQLite 파일로 영속 저장합니다. **`src/app.js`는 아직 이 서버를 호출하지 않습니다** — 지금은 독립된 별개 구현이고, 프론트-백엔드 연동은 별도 작업입니다.

`node:sqlite`는 Node 22.x에서 `--experimental-sqlite` 플래그가 필요해서, 서버 관련 스크립트에서만 이 플래그를 명시합니다 (`src/*.test.mjs`를 돌리는 `npm test`에는 영향 없음).

```bash
npm run server        # 로컬 실행 (기본 포트 8787)
npm run test:server   # server/*.test.mjs
```

`server/`를 수정할 때는 `src/utils.js`/`src/geo.js`의 순수 함수(민감어 필터, 쿨다운, 거리 계산 등)를 재사용하고 중복 구현하지 마세요 — 상수(`BAD_WORDS` 등)만 `server/constants.js`에 별도로 둡니다 (`src/app.js`가 export하지 않아서 불가피한 중복입니다).

## 검증

```bash
npm run check
npm test
npm run test:e2e
npm run test:server
```

## 커밋 메시지

```text
feat: 새 기능
fix: 버그 수정
docs: 문서 수정
style: UI/CSS 수정
chore: 설정 변경
```
