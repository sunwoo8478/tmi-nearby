# Roadmap

## 1. Frontend polish (완료)

- [x] 카드 드래그 스와이프
- [x] 댓글 시트 애니메이션
- [x] 모바일 실기기 safe-area 대응
- [x] PWA 아이콘과 splash screen

## 2. Data layer (완료)

- [x] 게시물, 댓글, 반응 mock data 분리
- [x] localStorage 기반 임시 저장
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

## 5. 다음 후보

- 자동화 테스트 커버리지 확대 (현재 geo.js만 커버, app.js 핵심 로직으로 확장)
- docs/BACKEND.md 설계를 실제 API 구현으로 전환
- 실시간 알림/카드 수신 서버 연동
