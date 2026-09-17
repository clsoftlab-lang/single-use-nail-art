<!-- SPDX-License-Identifier: Apache-2.0
     Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국) -->

# 글로우팁 AI 백엔드 프록시

프런트엔드(정적 SPA)와 Anthropic Claude 사이에 놓이는 얇은 프록시입니다.
**브라우저는 API 키를 절대 보지 않습니다.** 키는 이 서버의 환경변수에만 존재하고,
Claude 호출과 스트리밍은 전부 서버 측에서 일어납니다.

- 모델: `claude-opus-5`
- SDK: [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript)
- 엔드포인트: `POST /api/ai`  (본문 `{ "task": "chat"|"coordi"|"summarize", "payload": {...} }`)
- 응답: 생성되는 대로 텍스트를 스트리밍 (`Content-Type: text/plain`)

## 실행

```bash
cd server
npm install                 # @anthropic-ai/sdk 설치
cp .env.example .env        # 그리고 .env 에 실제 키를 채웁니다
# .env: ANTHROPIC_API_KEY=sk-... , PORT=8787
npm start                   # http://localhost:8787/api/ai
```

`.env` 를 쓰지 않는다면 환경변수를 직접 넘겨도 됩니다:

```bash
ANTHROPIC_API_KEY=sk-... node index.mjs
```

## 프런트엔드 연결

`ai/config.js` 의 `AI_ENDPOINT` 를 이 서버 주소로 바꾸면 데모(mock)에서 실 AI로 전환됩니다:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

비워 두면(`""`) 프런트엔드는 백엔드 없이 결정론적 한국어 목업으로 동작합니다.

## 보안 주의

- **API 키는 서버 측에만.** 브라우저 코드·리포지토리·`ai/config.js` 어디에도 키를 넣지 마세요.
- `.env` 는 커밋 금지(`.gitignore` 로 제외됨).
- 데모 CORS 는 모든 오리진을 허용합니다. 운영에서는 허용 도메인을 좁히세요.

## 라이선스

Apache-2.0. **Not an official Anthropic product.**
