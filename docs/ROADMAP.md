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

## 3. Backend candidate (docs/BACKEND.md에 API 설계로 문서화됨 — 실제 서버 구현은 아님)

- [x] 익명 세션 발급
- [x] 반경 기반 게시물 조회
- [x] 댓글/반응/투표 API
- [x] 신고, 숨김, 차단 API

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

- (완료) 자동화 테스트 커버리지 확대 — geo.js, utils.js, data.js 3개 파일, 75개 테스트로 확장. app.js 자체는 DOM 의존적이라 순수 로직만 utils.js로 계속 분리해 커버
- docs/BACKEND.md 설계를 실제 API 구현으로 전환
- 실시간 알림/카드 수신 서버 연동
