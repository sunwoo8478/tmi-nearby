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

## 검증

```bash
npm run check
npm test
```

## 커밋 메시지

```text
feat: 새 기능
fix: 버그 수정
docs: 문서 수정
style: UI/CSS 수정
chore: 설정 변경
```
