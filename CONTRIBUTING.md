# Contributing

이 저장소는 포트폴리오용 프론트엔드 프로토타입입니다. 변경할 때는 화면 완성도와 모바일 사용성을 우선합니다.

## 작업 기준

- 모바일 뷰에서 먼저 확인합니다.
- 색상과 간격은 `src/styles.css`의 CSS 변수와 기존 패턴을 우선 사용합니다.
- 기능을 추가할 때는 `src/app.js`의 UI 흐름과 `src/data.js`의 mock data 구조를 깨지 않게 유지합니다.
- 순수 로직은 가능하면 `src/geo.js`, `src/utils.js`처럼 별도 모듈로 분리하고 테스트를 같이 추가합니다.

## 프로젝트 구조

| 파일 | 역할 |
| --- | --- |
| `src/app.js` | 화면 렌더링과 사용자 인터랙션 |
| `src/data.js` | mock 게시물, 알림, 내 글 데이터 |
| `src/geo.js` | 위치, 거리 계산 유틸리티 |
| `src/utils.js` | DOM과 분리 가능한 공용 순수 함수 |
| `src/*.test.mjs` | `node:test` 기반 유틸리티 테스트 |

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
