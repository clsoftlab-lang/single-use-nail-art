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
check.mjs             # verification / unit tests
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

## 🎓 Idea origin

The seed idea for this project came from the **entrepreneurship class taught by Dr. Lee Il-guk (이일국) at Yongin University (용인대학교)**. The students in that class produced startup ideas of remarkable, standout creativity — this project is one of those exceptional ideas, finally brought to life as a working service. Built with deep admiration and gratitude for those students' imagination. *(No student personal information is included; only the idea itself was used, implemented clean-room.)*
