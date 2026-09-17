<!-- SPDX-License-Identifier: Apache-2.0
     Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국) -->

# 글로우팁 (GlowTip) — Single-Use Nail Art Shop

A no-build, static commerce demo for **single-use, paint-on gel nail-art kits** — an alternative to
stick-on nail stickers, with glitter, cubic (rhinestone), French, and matte styles. The Korean-language
storefront runs entirely in the browser: browse a catalog, preview shades on an interactive SVG hand,
get skin-tone/occasion recommendations, manage a wishlist and cart, simulate checkout, and subscribe to
a monthly color box.

**한국어 문서: [README.ko.md](./README.ko.md)**

## LIVE DEMO

**https://clsoftlab-lang.github.io/single-use-nail-art/**

## Features

- **Catalog** — 34 fictional kits with filters (style, season, tone), price slider, search, and sorting.
- **Product detail** — color swatch, components, step-by-step how-to, and reviews in a modal.
- **Interactive nail preview** — pick a shade and the inline-SVG hand recolors its nails; switch between
  glitter / cubic / French / matte overlays live.
- **Cart + simulated payment** — add/remove, adjust quantity, and run a mock checkout.
- **Monthly subscription** — three color-box plans you can subscribe to / cancel.
- **Wishlist** — heart any shade; persists locally.
- **Color-match recommendation** — choose skin tone (warm/cool) + occasion and see scored suggestions.
- **Responsive**, mobile-first, with light + dark themes via `prefers-color-scheme`.
- **State** persists in `localStorage` (with try/catch and a one-tap reset).

## How the nail preview + recommendation work

- **Preview** (`modules/svgNails.js`): `renderHandSVG({ hex, accentHex, style })` builds a hand as pure
  inline SVG. Nails are filled with the chosen `hex`; the `style` adds an overlay — a curved French tip,
  scattered glitter dots, diamond "cubic" gems, or a matte darkening layer. Picking a swatch chip or a
  product's "미리보기에 적용" button updates state and re-renders instantly.
- **Recommendation** (`modules/recommend.js`): `shadeRecommend(products, { warmCool, situation, limit })`
  is a pure function that scores each product — +3 for a matching warm/cool tone, +4 for a matching
  occasion (`vibe`), plus a small rating weight — then sorts descending. It is unit-tested in `check.mjs`.

## Run locally

```bash
# from the repo root
python -m http.server 9004
# open http://localhost:9004
```

Any static file server works (the app uses `fetch` on relative `data/*.json`, so open it over HTTP, not
via `file://`).

## Verify

```bash
node check.mjs        # JSON parse + node --check all JS + index.html containers + unit tests
```

## Project files

```
index.html            # markup + all containers
styles.css            # light/dark responsive styles
app.js                # app controller (rendering, events, tabs)
modules/store.js      # localStorage state (cart/wishlist/subscription) + pure derivations
modules/recommend.js  # pure shadeRecommend + situationCopy helpers
modules/svgNails.js   # inline-SVG hand renderer
data/products.json    # 34 fictional kits
data/subscriptions.json  # 3 color-box plans
data/recommend.json   # skin tones + occasions
ai/config.js          # AI_ENDPOINT ("" ⇒ mock; a URL ⇒ real backend)
ai/ai.js              # askAI(task, payload) — mock provider + streaming proxy client
server/index.mjs      # backend proxy: POST /api/ai → Claude (default claude-haiku-4-5), key server-side
server/worker.js      # Cloudflare Workers variant (Anthropic REST, free unmanned deploy)
server/wrangler.toml  # Workers deploy config (key via `wrangler secret put`, never in vars)
server/package.json   # @anthropic-ai/sdk dependency
server/.env.example   # ANTHROPIC_API_KEY placeholder (copy to .env, git-ignored)
server/README.md      # backend run + cost/model + Workers deploy + security notes
check.mjs             # verification / unit tests (incl. AI layer + key-leak scan)
.github/workflows/ci.yml  # runs node check.mjs
```

## DEMO-MODE boundaries

- **All products, brands, prices, and reviews are fictional.** No real merchandise exists.
- **Payment and subscription are simulated** — no money moves, no orders are placed.
- **State lives only in browser `localStorage`** — it is not a real database, is per-device, and can be
  cleared at any time (use the ↺ reset button).
- **No accounts, no login, no PII collection.**
- A real build would add a backend, a real product catalog and inventory, real payments, and
  authentication.

## Contributors

- Dr. Lee Il-guk (이일국)
- LWJ
- LMJ
- Claude

## License

- Code: **Apache-2.0** (see [LICENSE](./LICENSE))
- Documentation: **CC BY 4.0**

**Not an official Anthropic product.**

## 🤖 AI 기능 (API 연동)

The app ships a small, pluggable **AI layer** with three features, all reachable from the
**AI 어시스턴트 ✨** tab (and the product detail modal):

1. **AI 네일 컬러/스타일 추천 챗봇** — describe your skin tone / occasion and get grounded shade
   picks (reuses the app's products + `shadeRecommend`).
2. **상황별 코디 추천** — pick an occasion and get an outfit + matching-nail suggestion.
3. **상품 설명/후기 요약 생성** — the **AI 요약 ✨** button on any product summarizes its
   description and reviews.

### Demo = mock (default)

With `ai/config.js` `AI_ENDPOINT` left empty (`""`), everything runs against a **deterministic
Korean MockProvider** — no backend, no API key, no network. This is the default and what the live
demo uses.

### Enabling real AI (Claude)

Real inference goes through the backend proxy in [`server/`](./server/) so that
**keys stay server-side only — never in the browser or the repository.**

```bash
cd server
npm install
cp .env.example .env          # set ANTHROPIC_API_KEY=sk-...
npm start                     # POST http://localhost:8787/api/ai  (model: claude-haiku-4-5)
```

Then point the frontend at it:

```js
// ai/config.js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

The browser sends `{ task, payload }` to the proxy; the proxy calls Claude
(`client.messages.stream`, default model **`claude-haiku-4-5`**, configurable via `AI_MODEL`) and
streams text back. `askAI()` streams the same way whether the source is the mock or the backend, and
auto-falls back to the mock if the backend fails (see **고도화** below).

> **🔒 API keys live server-side only.** Never place a key in `ai/config.js`, browser code, or any
> committed file. `.env` is git-ignored; `.env.example` ships a placeholder. `check.mjs` fails the
> build if `AI_ENDPOINT` is non-empty or a real key format appears anywhere in the repo.

## ⚙️ 고도화 — 무인·저비용 실 AI 연동

The AI layer is tuned for **unmanned (무인) operation at a sensible cost**, while the demo still runs
100% client-side on the mock (no key, no server).

- **Cost-first default model.** The proxy defaults to **`claude-haiku-4-5`** (~**$1 / $5 per MTok**
  in/out), configurable via `AI_MODEL` (raise to `claude-sonnet-5` / `claude-opus-5` for higher quality).
- **Prompt caching.** Each task's stable system prompt is sent as a cached `system` block
  (`cache_control: { type: 'ephemeral' }`), so repeated calls read the cache and cost less.
- **Output caps + budget.** Modest per-task `max_tokens` (~700), a per-IP rate limit (20/min), and a
  monthly token cap (`AI_MONTHLY_TOKEN_CAP`, default 2,000,000). Over the cap → `429 {fallback:true}`.
- **Rough cost estimate.** With Haiku 4.5 and prompt caching, a typical grounded request runs on the
  order of **~$0.003–0.005**, i.e. **≈ $3–5 per 1,000 requests** (varies with payload/answer length).
- **Free one-deploy (무인).** A Cloudflare **Workers** variant ([`server/worker.js`](./server/worker.js)
  + [`wrangler.toml`](./server/wrangler.toml)) calls the Anthropic REST API with the same task routing
  and caching rules — no server to babysit. Deploy: `wrangler secret put ANTHROPIC_API_KEY && wrangler deploy`.
- **Autonomous mock-fallback.** On any failure / `429 {fallback:true}` / network error, `askAI()`
  auto-falls back to the built-in mock, so the app **never breaks**. The catalog's on-load
  **"🗓️ 오늘의 추천 네일 컬러/스타일"** digest is built from the shade recommender via `askAI`, so it
  works offline on the mock too.

> **🔒 API keys are server-side only — never in the browser or the repo.** The key lives only in the
> server environment (or a Worker secret). `.env` and `wrangler.toml` `[vars]` never hold a real key;
> `check.mjs` fails the build if `AI_ENDPOINT` is non-empty or a real `sk-ant-…` key format appears anywhere.

## 🎓 Idea origin

The seed idea for this project came from the **entrepreneurship class taught by Dr. Lee Il-guk (이일국) at Yongin University (용인대학교)**. The students in that class produced startup ideas of remarkable, standout creativity — this project is one of those exceptional ideas, finally brought to life as a working service. Built with deep admiration and gratitude for those students' imagination. *(No student personal information is included; only the idea itself was used, implemented clean-room.)*
