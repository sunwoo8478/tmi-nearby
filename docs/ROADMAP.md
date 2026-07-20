# Roadmap

## 1. Frontend polish (완료)

- [x] 카드 드래그 스와이프
- [x] 댓글 시트 애니메이션
- [x] 모바일 실기기 safe-area 대응
- [x] PWA 아이콘과 splash screen
- [x] 접근성 보완 (토스트 aria-live, index.html aria-hidden/aria-label)

## 2. Data layer (완료)

- [x] 게시물, 댓글, 반응 mock data 분리
- [x] localStorage 기반 임시 저장 (작성 글, 숨김, 차단, 신고, 투표, 알림 닫기, 닉네임 전체 영속화)
- [x] API 응답 타입 정리

## 3. Backend candidate (`server/`에 실제 구현됨 — Node 내장 http + node:sqlite, 새 의존성 0개)

- [x] 익명 세션 발급 (닉네임 24h TTL 회전 포함)
- [x] 반경 기반 게시물 조회 (페이지네이션, 차단/숨김 세션 스코프 제외)
- [x] 댓글/반응/투표 API (투표는 세션당 1회, DB UNIQUE 제약으로 강제)
- [x] 신고, 숨김, 차단 API (신고 중복은 DB UNIQUE 제약으로 강제)
- [ ] 프론트엔드(`src/app.js`)를 이 서버와 연동 (지금은 서버만 독립적으로 존재, 프론트는 여전히 localStorage 기반)

## 4. Safety (완료)

- [x] 거리 기반 노출 제한
- [x] 동일 사용자의 반복 신고 방지
- [x] 민감어 필터링
- [x] 짧은 시간 내 과도한 작성 제한
- [x] 사용자 상태(신고/숨김/차단/투표/알림 닫기) 새로고침 영속화

## 5. Stability (완료)

- [x] 카드 메뉴가 열린 채로 피드가 재렌더될 때 document 리스너 정리
- [x] 드래그 포인터 캡처가 강제로 풀릴 때 dragState 정리
- [x] 작성 시트 재오픈 시 이전 텍스트/경고 초기화
- [x] 숨김 해제/차단 해제 후 피드 갱신
- [x] 프로필 통계(올린 TMI/받은 반응) 갱신
- [x] 위치 정보 실패 시 안내 토스트

## 6. 다음 후보

- (완료) 자동화 테스트 커버리지 확대 — geo.js, utils.js, data.js 3개 파일, 75개 단위 테스트 + Playwright E2E 스모크 테스트(`e2e/smoke.spec.js`, 7개 시나리오)로 DOM/localStorage 흐름까지 커버
- (완료) docs/BACKEND.md 설계를 실제 API 구현으로 전환 — `server/`, 31개 서버 테스트
- 프론트엔드를 `server/` API와 연동 (localStorage → fetch 전환)
- 실시간 알림/카드 수신 서버 연동
