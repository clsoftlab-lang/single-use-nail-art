<!-- SPDX-License-Identifier: Apache-2.0
     Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국) -->

# 글로우팁 AI 백엔드 프록시 (REFERENCE)

프런트엔드(정적 SPA)와 Anthropic Claude 사이에 놓이는 얇은 프록시입니다.
**브라우저는 API 키를 절대 보지 않습니다.** 키는 이 서버의 환경변수에만 존재하고,
Claude 호출과 스트리밍은 전부 서버 측에서 일어납니다.

> **데모는 이 서버가 필요 없습니다.** `ai/config.js` 의 `AI_ENDPOINT = ""`(기본값)이면
> 앱은 내장 결정론적 **MockProvider**로 완전히 클라이언트 측에서 동작합니다.
> 실 LLM 응답이 필요할 때만 이 프록시를 배포하세요.

- 기본 모델: **`claude-haiku-4-5`** (비용 우선, ~$1/$5 per MTok). `AI_MODEL` 로 상향 가능.
- SDK: [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript)
- 엔드포인트: `POST /api/ai`  (본문 `{ "task": "chat"|"coordi"|"summarize", "payload": {...} }`)
- 응답: 생성되는 대로 텍스트를 스트리밍 (`Content-Type: text/plain`)

## 실행 (운영자 환경에서만 — CI·이 저장소에서는 실행 금지)

```bash
cd server
npm install                 # @anthropic-ai/sdk 설치
cp .env.example .env        # 그리고 .env 에 실제 키를 채웁니다
# .env: ANTHROPIC_API_KEY=... , PORT=8787
npm start                   # http://localhost:8787/api/ai (model=claude-haiku-4-5)
```

`.env` 를 쓰지 않는다면 환경변수를 직접 넘겨도 됩니다:

```bash
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY node index.mjs
```

### 비용·모델 환경변수

| 변수 | 기본값 | 의미 |
|------|--------|------|
| `AI_MODEL` | `claude-haiku-4-5` | 비용 우선 기본값. `claude-sonnet-5` / `claude-opus-5` 로 품질 상향 가능. |
| `AI_EFFORT` | `low` | Sonnet/Opus 전용 effort (Haiku 는 thinking/effort 를 받지 않음). |
| `AI_RATE_PER_MIN` | `20` | IP당 분당 요청 상한; 초과 시 `429 {fallback:true}`. |
| `AI_MONTHLY_TOKEN_CAP` | `2000000` | 월 토큰 예산; 초과 시 `429 {fallback:true}`. |

**저비용 설계 요약:** 기본 **Haiku 4.5**, 태스크별 **프롬프트 캐싱**(안정적 system 블록에
`cache_control`), 태스크별 modest `max_tokens`(~700), adaptive thinking/effort 는 Sonnet/Opus
에만 적용(Haiku 는 거부 → 400 방지), 그리고 위의 레이트 리밋 + 월 토큰 예산 가드레일.
`429 {fallback:true}` 시 프런트엔드는 내장 mock 으로 자동 폴백하므로 앱은 절대 멈추지 않습니다(무인).

## 무료 무인 배포 — Cloudflare Workers (무인)

**서버를 돌보지 않아도 되는 무료 배포**는 Worker 변형 [`worker.js`](./worker.js) +
[`wrangler.toml`](./wrangler.toml) 을 사용하세요. Node SDK 대신 Anthropic REST
(`POST https://api.anthropic.com/v1/messages`)를 직접 호출하며, `index.mjs` 와 **동일한
태스크 라우팅·모델·프롬프트 캐싱 규칙**을 씁니다.

```bash
cd server
wrangler secret put ANTHROPIC_API_KEY   # 키는 오직 Worker 시크릿으로만 — 저장소엔 없음
wrangler deploy                         # → https://single-use-nail-art-ai.<you>.workers.dev
```

그런 다음 [`../ai/config.js`](../ai/config.js) 의 `AI_ENDPOINT` 를 `https://…workers.dev/api/ai`
로 설정합니다. `AI_MODEL` / `AI_EFFORT` / `ALLOW_ORIGIN` 은 `wrangler.toml` 의 `[vars]` 로 지정할 수
있고, 업스트림 실패 시 Worker 는 `429 {fallback:true}` 를 반환해 프런트가 mock 으로 자동 폴백합니다.

## 프런트엔드 연결

`ai/config.js` 의 `AI_ENDPOINT` 를 이 서버(또는 Worker) 주소로 바꾸면 데모(mock)에서 실 AI로 전환됩니다:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

비워 두면(`""`) 프런트엔드는 백엔드 없이 결정론적 한국어 목업으로 동작합니다.

## 보안 주의

- **API 키는 서버 측에만.** 브라우저 코드·리포지토리·`ai/config.js` 어디에도 키를 넣지 마세요.
- `.env` 는 커밋 금지(`.gitignore` 로 제외됨). `wrangler.toml` 의 `[vars]` 에도 키를 넣지 말고
  반드시 `wrangler secret put` 으로만 주입하세요.
- 데모 CORS 는 모든 오리진(`ALLOW_ORIGIN=*`)을 허용합니다. 운영에서는 배포 도메인으로 좁히세요.

## 라이선스

Apache-2.0. **Not an official Anthropic product.**
