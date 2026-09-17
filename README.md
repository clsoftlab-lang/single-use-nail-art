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
server/index.mjs      # backend proxy: POST /api/ai → Claude (claude-opus-5), key server-side
server/package.json   # @anthropic-ai/sdk dependency
server/.env.example   # ANTHROPIC_API_KEY placeholder (copy to .env, git-ignored)
server/README.md      # backend run + security notes
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
npm start                     # POST http://localhost:8787/api/ai  (model: claude-opus-5)
```

Then point the frontend at it:

```js
// ai/config.js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

The browser sends `{ task, payload }` to the proxy; the proxy calls Claude
(`client.messages.stream`, model **`claude-opus-5`**) and streams text back. `askAI()` streams the
same way whether the source is the mock or the backend.

> **🔒 API keys live server-side only.** Never place a key in `ai/config.js`, browser code, or any
> committed file. `.env` is git-ignored; `.env.example` ships a placeholder. `check.mjs` fails the
> build if `AI_ENDPOINT` is non-empty or a real key format appears anywhere in the repo.

## 🎓 Idea origin

The seed idea for this project came from the **entrepreneurship class taught by Dr. Lee Il-guk (이일국) at Yongin University (용인대학교)**. The students in that class produced startup ideas of remarkable, standout creativity — this project is one of those exceptional ideas, finally brought to life as a working service. Built with deep admiration and gratitude for those students' imagination. *(No student personal information is included; only the idea itself was used, implemented clean-room.)*
