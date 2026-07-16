# Backend Candidate

TMI Nearby가 정적 프로토타입에서 실제 서비스로 확장된다면, 현재의 mock data와 localStorage 상태는 익명 세션 기반 API와 데이터베이스로 이동합니다. 이 문서는 `users`, `posts`, `votes`, `locations` 후보 구조를 기준으로 필요한 백엔드 API를 정리합니다.

## 기본 방향

| 항목 | 설계 |
| --- | --- |
| 인증 | 실명 계정 대신 익명 세션 토큰 사용 |
| 위치 | 클라이언트가 위도/경도를 보내고 서버가 반경 노출을 계산 |
| 피드 | 반경 안의 게시물만 카드 API로 반환 |
| 저장 | 게시물, 댓글, 반응, 투표, 신고/숨김/차단을 서버에 저장 |
| 안전 | 반복 신고, 과도한 작성, 민감 정보 노출을 서버에서 제한 |

## 데이터 후보

```text
users
  └─ anonymous_sessions
posts
  ├─ comments
  ├─ reactions
  └─ reports
votes
  └─ vote_options
locations
  └─ radius_visibility
```

## 인증 방식

익명 세션 발급 후 모든 쓰기 API는 세션 토큰을 헤더로 보냅니다. 토큰은 사용자 식별 대신 기기 단위의 임시 익명성을 유지하는 용도로만 사용합니다.

```http
Authorization: Bearer <anonymous_session_token>
```

| 필드 | 설명 |
| --- | --- |
| `sessionId` | 서버 내부 익명 세션 ID |
| `token` | 클라이언트가 보관하는 세션 토큰 |
| `nickname` | 하루 단위로 회전 가능한 익명 닉네임 |
| `expiresAt` | 세션 만료 시각 |

## 익명 세션 API

### 세션 발급

```http
POST /api/sessions/anonymous
```

Request

```json
{
  "deviceId": "optional-client-generated-id",
  "locale": "ko-KR"
}
```

Response

```json
{
  "sessionId": "as_123",
  "token": "anonymous-session-token",
  "nickname": "익명의 라쿤",
  "expiresAt": "2026-07-17T00:00:00+09:00"
}
```

## 반경 기반 게시물 API

### 피드 조회

```http
GET /api/posts/nearby?lat=37.5665&lng=126.9780&radiusM=50&cursor=optional
Authorization: Bearer <anonymous_session_token>
```

Response

```json
{
  "items": [
    {
      "id": "post_123",
      "type": "tmi",
      "who": "익명의 사과",
      "distance": "12m",
      "text": "방금 계산대에서 카드 거꾸로 꽂음",
      "commentsCount": 2,
      "reactions": [{ "key": "laugh", "label": "😂", "count": 14 }],
      "watching": 31,
      "createdAt": "2026-07-16T11:20:00+09:00"
    }
  ],
  "nextCursor": "cursor_456"
}
```

### 게시물 작성

```http
POST /api/posts
Authorization: Bearer <anonymous_session_token>
```

Request

```json
{
  "type": "tmi",
  "text": "아침에 산 커피 아직도 반 남음",
  "lat": 37.5665,
  "lng": 126.9780,
  "radiusM": 50
}
```

Response

```json
{
  "id": "post_123",
  "type": "tmi",
  "who": "익명의 라쿤",
  "distance": "0m",
  "text": "아침에 산 커피 아직도 반 남음",
  "createdAt": "2026-07-16T11:22:00+09:00"
}
```

## 댓글 API

### 댓글 목록

```http
GET /api/posts/{postId}/comments
Authorization: Bearer <anonymous_session_token>
```

Response

```json
{
  "items": [
    {
      "id": "comment_123",
      "who": "익명의 복숭아",
      "text": "저도 그거 궁금했어요 ㅋㅋ",
      "createdAt": "2026-07-16T11:24:00+09:00"
    }
  ]
}
```

### 댓글 작성

```http
POST /api/posts/{postId}/comments
Authorization: Bearer <anonymous_session_token>
```

Request

```json
{
  "text": "나만 그런 게 아니었네"
}
```

Response

```json
{
  "id": "comment_124",
  "who": "익명의 라쿤",
  "text": "나만 그런 게 아니었네",
  "createdAt": "2026-07-16T11:25:00+09:00"
}
```

## 반응 API

### 반응 남기기

```http
POST /api/posts/{postId}/reactions
Authorization: Bearer <anonymous_session_token>
```

Request

```json
{
  "key": "laugh"
}
```

Response

```json
{
  "postId": "post_123",
  "reactions": [
    { "key": "laugh", "label": "😂", "count": 15 },
    { "key": "fire", "label": "🔥", "count": 12 }
  ]
}
```

## 투표 API

### 투표 게시물 작성

```http
POST /api/posts
Authorization: Bearer <anonymous_session_token>
```

Request

```json
{
  "type": "vote",
  "text": "지금 카페에서 집중 안 될 때 더 나은 선택은?",
  "lat": 37.5665,
  "lng": 126.9780,
  "radiusM": 50,
  "options": [
    { "label": "자리 옮기기" },
    { "label": "음료 하나 더" }
  ]
}
```

### 투표하기

```http
POST /api/posts/{postId}/votes
Authorization: Bearer <anonymous_session_token>
```

Request

```json
{
  "optionId": "option_1"
}
```

Response

```json
{
  "postId": "post_456",
  "options": [
    { "id": "option_1", "label": "자리 옮기기", "pct": 62, "count": 31 },
    { "id": "option_2", "label": "음료 하나 더", "pct": 38, "count": 19 }
  ],
  "votedOptionId": "option_1"
}
```

## 신고, 숨김, 차단 API

익명 서비스의 안전 기능은 사용자의 피드 경험과 운영 moderation을 분리해서 다룹니다. 숨김과 차단은 즉시 개인 피드에 반영하고, 신고는 서버에 누적해 운영 정책으로 처리합니다.

| 기능 | 엔드포인트 | 설명 |
| --- | --- | --- |
| 게시물 신고 | `POST /api/posts/{postId}/reports` | 부적절한 게시물 신고 |
| 댓글 신고 | `POST /api/comments/{commentId}/reports` | 부적절한 댓글 신고 |
| 게시물 숨김 | `POST /api/posts/{postId}/hide` | 내 피드에서 해당 게시물 숨김 |
| 사용자 차단 | `POST /api/sessions/{targetSessionId}/block` | 특정 익명 세션의 글/댓글 숨김 |

Report Request

```json
{
  "reason": "harassment",
  "memo": "선택 입력"
}
```

Report Response

```json
{
  "reportId": "report_123",
  "status": "received"
}
```

Hide Response

```json
{
  "postId": "post_123",
  "hidden": true
}
```

Block Response

```json
{
  "targetSessionId": "as_456",
  "blocked": true,
  "expiresAt": "2026-07-17T00:00:00+09:00"
}
```

## 서버 검증 규칙

| 영역 | 규칙 |
| --- | --- |
| 거리 | `radiusM`은 허용 범위 안에서만 사용하고 서버가 거리 계산을 다시 수행 |
| 작성 속도 | 세션별 짧은 시간 내 게시물/댓글 작성 횟수 제한 |
| 반복 신고 | 동일 세션의 동일 대상 중복 신고 방지 |
| 투표 | 세션별 게시물당 1회 투표만 허용 |
| 민감 정보 | 전화번호, 상세 주소, 실명 노출 가능성이 있는 문구 필터링 |
| 차단/숨김 | 피드 조회 시 차단 세션과 숨김 게시물을 제외 |

