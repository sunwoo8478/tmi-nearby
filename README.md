# TMI Nearby

반경 안의 짧은 TMI와 양자택일 투표를 익명으로 넘겨보는 모바일 웹 프로토타입입니다.  
원본 디자인의 어두운 글래스 무드와 라임 포인트를 유지하면서, GitHub에 올릴 수 있는 실행형 프론트 프로젝트로 정리했습니다.

![TMI Nearby feed](./assets/shots/feed.png)

## 핵심 컨셉

| 구분 | 설명 |
| --- | --- |
| Feed | 반경 안의 익명 TMI와 투표 카드를 스택 형태로 탐색 |
| Interaction | 좋아요/넘기기, 댓글 보기, 투표 선택 |
| Compose | TMI 또는 투표 형식으로 새 글 작성 |
| Tabs | 홈, 알림, 내 정보 화면 구성 |
| Mood | iOS 스타일 디바이스 프레임, 다크 글래스, 라임 액센트 |

## 화면

| Feed | Detail |
| --- | --- |
| ![feed](./assets/shots/feed.png) | ![detail](./assets/shots/detail.png) |

## 실행 방법

의존성 없이 바로 실행할 수 있습니다.

```bash
python3 -m http.server 5173
```

브라우저에서 `http://localhost:5173`을 엽니다.

또는 패키지 스크립트를 사용할 수 있습니다.

```bash
npm run dev
```

## 검증

```bash
npm run check
```

## 프로젝트 구조

```text
.
├── index.html
├── src/
│   ├── app.js
│   └── styles.css
├── assets/
│   └── shots/
├── .github/
│   └── workflows/
└── docs/
    ├── PRODUCT.md
    └── ROADMAP.md
```

## 구현 메모

- 별도 프레임워크 없이 HTML, CSS, JavaScript로 구성했습니다.
- GitHub Pages에 바로 배포할 수 있는 정적 구조입니다.
- 카드 데이터는 `src/app.js` 안의 mock data로 관리합니다.
- 추후 위치 권한, WebSocket, Supabase/Firebase, 신고/차단 기능을 붙일 수 있습니다.

## 다음 단계

- [Product Notes](./docs/PRODUCT.md)
- [Roadmap](./docs/ROADMAP.md)
- [Contributing](./CONTRIBUTING.md)
