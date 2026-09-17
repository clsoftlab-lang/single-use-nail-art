// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

import * as store from './modules/store.js';
import { shadeRecommend, situationCopy } from './modules/recommend.js';
import { renderHandSVG } from './modules/svgNails.js';
import { askAI } from './ai/ai.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const won = (n) => n.toLocaleString('ko-KR') + '원';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  products: [],
  plans: [],
  meta: { skinTones: [], situations: [] },
  app: store.loadState(),
  filters: { q: '', style: 'all', season: 'all', warmCool: 'all', maxPrice: 0, sort: 'popular' },
  preview: { hex: '#e6789a', accentHex: '#ffd1e0', style: '글리터', name: '로즈 페탈 글리터' },
};

function persist() {
  store.saveState(state.app);
  renderBadges();
}

// ---------- 데이터 로드 ----------
async function loadData() {
  const [p, s, r] = await Promise.all([
    fetch('./data/products.json').then((x) => x.json()),
    fetch('./data/subscriptions.json').then((x) => x.json()),
    fetch('./data/recommend.json').then((x) => x.json()),
  ]);
  state.products = p.products;
  state.plans = s.plans;
  state.meta = { skinTones: r.skinTones, situations: r.situations };
}

// ---------- 필터링 ----------
function applyFilters() {
  const f = state.filters;
  let list = state.products.filter((p) => {
    if (f.style !== 'all' && p.style !== f.style) return false;
    if (f.season !== 'all' && p.season !== f.season && p.season !== '사계절') return false;
    if (f.warmCool !== 'all' && p.warmCool !== f.warmCool) return false;
    if (f.maxPrice && p.price > f.maxPrice) return false;
    if (f.q) {
      const hay = (p.name + ' ' + p.brand + ' ' + p.tags.join(' ') + ' ' + p.desc).toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
  const s = f.sort;
  list.sort((a, b) => {
    if (s === 'priceLow') return a.price - b.price;
    if (s === 'priceHigh') return b.price - a.price;
    if (s === 'rating') return b.rating - a.rating;
    return b.reviewCount - a.reviewCount; // popular
  });
  return list;
}

// ---------- 카드 ----------
function productCard(p) {
  const wished = state.app.wishlist.includes(p.id);
  return `<article class="card" data-id="${p.id}">
    <button class="wish ${wished ? 'on' : ''}" data-wish="${p.id}" aria-label="찜">${wished ? '♥' : '♡'}</button>
    <button class="card-swatch" data-detail="${p.id}" aria-label="${esc(p.name)} 상세" style="--c:${p.hex};--a:${p.accentHex}">
      <span class="mini-nails" aria-hidden="true"></span>
    </button>
    <div class="card-body">
      <div class="card-tags"><span class="tag">${esc(p.style)}</span><span class="tag ghost">${esc(p.season)}</span></div>
      <h3 data-detail="${p.id}">${esc(p.name)}</h3>
      <p class="brand">${esc(p.brand)} · ★ ${p.rating} (${p.reviewCount})</p>
      <div class="card-foot">
        <strong>${won(p.price)}</strong>
        <div class="card-actions">
          <button class="btn small ghost" data-preview="${p.id}">미리보기</button>
          <button class="btn small" data-add="${p.id}">담기</button>
        </div>
      </div>
    </div>
  </article>`;
}

function renderCatalog() {
  const list = applyFilters();
  $('#result-count').textContent = `${list.length}개 제품`;
  const grid = $('#catalog-grid');
  grid.innerHTML = list.length
    ? list.map(productCard).join('')
    : '<p class="empty">조건에 맞는 제품이 없어요. 필터를 조정해 보세요.</p>';
  // 미니 손톱 스와치 채우기
  $$('.card-swatch', grid).forEach((el) => {
    const id = el.getAttribute('data-detail');
    const p = state.products.find((x) => x.id === id);
    if (p) $('.mini-nails', el).innerHTML = miniNails(p.hex, p.accentHex, p.style);
  });
}

function miniNails(hex, accent, style) {
  let s = '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
  for (let i = 0; i < 5; i++) {
    const x = 12 + i * 18;
    s += `<rect x="${x}" y="8" width="12" height="24" rx="6" fill="${hex}"/>`;
    if (style === '프렌치') s += `<rect x="${x}" y="8" width="12" height="5" rx="2" fill="${accent}"/>`;
    else if (style === '큐빅') s += `<circle cx="${x + 6}" cy="16" r="2" fill="${accent}"/>`;
    else if (style === '글리터') s += `<circle cx="${x + 4}" cy="20" r="1.2" fill="${accent}"/><circle cx="${x + 8}" cy="26" r="1.2" fill="${accent}"/>`;
  }
  return s + '</svg>';
}

// ---------- 미리보기 ----------
function renderPreview() {
  $('#preview-stage').innerHTML = renderHandSVG(state.preview);
  $('#preview-name').textContent = state.preview.name;
  $('#preview-style').textContent = state.preview.style;
  const chips = state.products.map((p) =>
    `<button class="shade-chip ${state.preview.name === p.name ? 'on' : ''}" data-shade="${p.id}" title="${esc(p.name)}" style="background:${p.hex}"></button>`
  ).join('');
  $('#shade-chips').innerHTML = chips;
  // 스타일 토글
  $$('#style-toggle button').forEach((b) => b.classList.toggle('on', b.dataset.style === state.preview.style));
}

function setPreviewFrom(p) {
  state.preview = { hex: p.hex, accentHex: p.accentHex, style: p.style, name: p.name };
  renderPreview();
}

// ---------- 추천 ----------
function renderRecommend() {
  const tones = state.meta.skinTones.map((t, i) =>
    `<button class="pill ${i === 0 ? 'on' : ''}" data-tone="${t.id}" data-wc="${t.warmCool}">${esc(t.label)}</button>`
  ).join('');
  const sits = state.meta.situations.map((s, i) =>
    `<button class="pill ${i === 0 ? 'on' : ''}" data-sit="${esc(s.id)}">${esc(s.label)}</button>`
  ).join('');
  $('#tone-pills').innerHTML = tones;
  $('#sit-pills').innerHTML = sits;
  runRecommend();
}

function runRecommend() {
  const wc = $('#tone-pills .pill.on')?.dataset.wc;
  const sit = $('#sit-pills .pill.on')?.dataset.sit;
  const results = shadeRecommend(state.products, { warmCool: wc, situation: sit, limit: 6 });
  $('#recommend-copy').textContent = situationCopy(sit);
  $('#recommend-grid').innerHTML = results.map(productCard).join('');
  $$('.card-swatch', $('#recommend-grid')).forEach((el) => {
    const id = el.getAttribute('data-detail');
    const p = state.products.find((x) => x.id === id);
    if (p) $('.mini-nails', el).innerHTML = miniNails(p.hex, p.accentHex, p.style);
  });
}

// ---------- AI 어시스턴트 ----------
// 공통: task 결과를 element 로 스트리밍(onToken 누적).
async function streamInto(el, task, payload) {
  el.classList.add('show', 'streaming');
  el.textContent = '생각 중…';
  let first = true;
  try {
    await askAI(task, payload, {
      onToken: (chunk) => {
        if (first) { el.textContent = ''; first = false; }
        el.textContent += chunk;
      },
    });
  } catch (err) {
    el.textContent = 'AI 응답을 불러오지 못했어요. ' + (err && err.message ? err.message : '');
  } finally {
    el.classList.remove('streaming');
  }
}

function renderAI() {
  const sitOpts = state.meta.situations.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
  $('#ai-sit').innerHTML = '<option value="">상관없음</option>' + sitOpts;
  $('#ai-coordi-pills').innerHTML = state.meta.situations
    .map((s, i) => `<button class="pill ${i === 0 ? 'on' : ''}" data-coordi="${esc(s.id)}">${esc(s.label)}</button>`)
    .join('');
}

function appendChat(role, text) {
  const log = $('#ai-chat-log');
  const bubble = document.createElement('div');
  bubble.className = 'ai-bubble ' + (role === 'user' ? 'me' : 'ai');
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

function wireAI() {
  // (1) 챗봇
  $('#ai-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#ai-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    appendChat('user', msg);
    input.value = '';
    const bubble = appendChat('ai', '생각 중…');
    let first = true;
    try {
      await askAI('chat', {
        message: msg,
        warmCool: $('#ai-tone').value || undefined,
        situation: $('#ai-sit').value || undefined,
        products: state.products,
      }, {
        onToken: (chunk) => {
          if (first) { bubble.textContent = ''; first = false; }
          bubble.textContent += chunk;
          $('#ai-chat-log').scrollTop = $('#ai-chat-log').scrollHeight;
        },
      });
    } catch (err) {
      bubble.textContent = 'AI 응답을 불러오지 못했어요. ' + (err && err.message ? err.message : '');
    }
  });

  // (2) 상황별 코디
  $('#ai-coordi-pills').addEventListener('click', (e) => {
    const b = e.target.closest('.pill'); if (!b) return;
    $$('#ai-coordi-pills .pill').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#ai-coordi-btn').addEventListener('click', () => {
    const sit = $('#ai-coordi-pills .pill.on')?.dataset.coordi || '데일리';
    streamInto($('#ai-coordi-out'), 'coordi', { situation: sit, products: state.products });
  });
}

// ---------- 구독 ----------
function renderSubscriptions() {
  const active = state.app.subscription;
  $('#subscription-grid').innerHTML = state.plans.map((pl) => {
    const isActive = active && active.planId === pl.id;
    return `<article class="plan ${isActive ? 'active' : ''}">
      <h3>${esc(pl.name)}</h3>
      <p class="plan-price">${won(pl.price)}<span>/월</span></p>
      <p class="plan-desc">${esc(pl.desc)}</p>
      <ul>${pl.perks.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      <p class="plan-items">매달 ${pl.itemsPerBox}종 구성</p>
      <button class="btn ${isActive ? 'ghost' : ''}" data-sub="${pl.id}">${isActive ? '구독 중 · 해지' : '구독하기'}</button>
    </article>`;
  }).join('');
}

// ---------- 찜 ----------
function renderWishlist() {
  const items = state.products.filter((p) => state.app.wishlist.includes(p.id));
  $('#wishlist-grid').innerHTML = items.length
    ? items.map(productCard).join('')
    : '<p class="empty">아직 찜한 제품이 없어요. 마음에 드는 컬러에 ♡를 눌러보세요.</p>';
  $$('.card-swatch', $('#wishlist-grid')).forEach((el) => {
    const id = el.getAttribute('data-detail');
    const p = state.products.find((x) => x.id === id);
    if (p) $('.mini-nails', el).innerHTML = miniNails(p.hex, p.accentHex, p.style);
  });
}

// ---------- 상세 모달 ----------
function openDetail(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  const wished = state.app.wishlist.includes(p.id);
  $('#modal-body').innerHTML = `
    <div class="detail">
      <div class="detail-visual">
        <div class="detail-hand">${renderHandSVG({ hex: p.hex, accentHex: p.accentHex, style: p.style })}</div>
        <div class="swatch-row">
          <span class="swatch-big" style="background:${p.hex}"></span>
          <div><strong>${esc(p.hex)}</strong><br><small>${esc(p.style)} · ${esc(p.warmCool)}톤 · ${esc(p.season)}</small></div>
        </div>
      </div>
      <div class="detail-info">
        <h2>${esc(p.name)}</h2>
        <p class="brand">${esc(p.brand)} · ★ ${p.rating} (${p.reviewCount} 리뷰)</p>
        <p>${esc(p.desc)}</p>
        <strong class="detail-price">${won(p.price)}</strong>
        <div class="detail-buttons">
          <button class="btn" data-add="${p.id}">장바구니 담기</button>
          <button class="btn ghost" data-wish="${p.id}">${wished ? '♥ 찜 해제' : '♡ 찜하기'}</button>
          <button class="btn ghost" data-preview="${p.id}">미리보기에 적용</button>
          <button class="btn ghost" data-summarize="${p.id}">AI 요약 ✨</button>
        </div>
        <div id="ai-summary-out" class="ai-out"></div>
        <h4>구성품</h4>
        <ul class="components">${p.components.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        <h4>사용법</h4>
        <ol class="steps">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <h4>리뷰</h4>
        <ul class="reviews">${p.reviews.map((r) => `<li><strong>${esc(r.user)}</strong> ${'★'.repeat(r.rating)}<br>${esc(r.text)}</li>`).join('')}</ul>
      </div>
    </div>`;
  const dlg = $('#modal');
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
}

function closeModal() {
  const dlg = $('#modal');
  if (typeof dlg.close === 'function') dlg.close();
  else dlg.removeAttribute('open');
}

// ---------- 장바구니 ----------
function renderCart() {
  const entries = Object.entries(state.app.cart);
  const body = $('#cart-body');
  if (!entries.length) {
    body.innerHTML = '<p class="empty">장바구니가 비어 있어요.</p>';
    $('#cart-total').textContent = won(0);
    $('#checkout-btn').disabled = true;
    return;
  }
  body.innerHTML = entries.map(([id, qty]) => {
    const p = state.products.find((x) => x.id === id);
    if (!p) return '';
    return `<div class="cart-line">
      <span class="cart-sw" style="background:${p.hex}"></span>
      <div class="cart-line-info"><strong>${esc(p.name)}</strong><small>${won(p.price)}</small></div>
      <div class="qty">
        <button data-dec="${id}" aria-label="수량 감소">−</button>
        <span>${qty}</span>
        <button data-inc="${id}" aria-label="수량 증가">+</button>
      </div>
      <button class="rm" data-rm="${id}" aria-label="삭제">✕</button>
    </div>`;
  }).join('');
  $('#cart-total').textContent = won(store.cartTotal(state.app, state.products));
  $('#checkout-btn').disabled = false;
}

function openCart() { $('#cart-drawer').classList.add('open'); $('#overlay').classList.add('show'); renderCart(); }
function closeCart() { $('#cart-drawer').classList.remove('open'); $('#overlay').classList.remove('show'); }

function mockCheckout() {
  const total = store.cartTotal(state.app, state.products);
  const count = store.cartCount(state.app);
  state.app = store.clearCart(state.app);
  persist();
  renderCart();
  $('#toast').textContent = `모의결제 완료! ${count}개 · ${won(total)} (데모: 실제 결제 아님)`;
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

// ---------- 배지 ----------
function renderBadges() {
  const c = store.cartCount(state.app);
  $('#cart-count').textContent = c;
  $('#cart-count').style.display = c ? 'grid' : 'none';
  const w = state.app.wishlist.length;
  const wb = $('#wish-count');
  wb.textContent = w;
  wb.style.display = w ? 'grid' : 'none';
}

// ---------- 탭 ----------
function showTab(name) {
  $$('.tab-panel').forEach((el) => el.classList.toggle('active', el.id === 'tab-' + name));
  $$('.tab-btn').forEach((el) => el.classList.toggle('active', el.dataset.tab === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- 이벤트 위임 ----------
function wireEvents() {
  document.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-detail],[data-add],[data-wish],[data-preview],[data-shade],[data-sub],[data-tab],[data-inc],[data-dec],[data-rm],[data-summarize]');
    if (!t) return;
    if (t.dataset.detail) { openDetail(t.dataset.detail); return; }
    if (t.dataset.summarize) {
      const p = state.products.find((x) => x.id === t.dataset.summarize);
      const out = $('#ai-summary-out');
      if (p && out) streamInto(out, 'summarize', { product: p });
      return;
    }
    if (t.dataset.add) {
      state.app = store.addToCart(state.app, t.dataset.add, 1);
      persist(); renderCart();
      $('#toast').textContent = '장바구니에 담았어요';
      $('#toast').classList.add('show');
      setTimeout(() => $('#toast').classList.remove('show'), 1800);
      return;
    }
    if (t.dataset.wish) {
      state.app = store.toggleWishlist(state.app, t.dataset.wish);
      persist(); renderCatalog(); renderWishlist(); runRecommend();
      if ($('#modal').open) openDetail(t.dataset.wish);
      return;
    }
    if (t.dataset.preview) {
      const p = state.products.find((x) => x.id === t.dataset.preview);
      if (p) { setPreviewFrom(p); closeModal(); showTab('preview'); }
      return;
    }
    if (t.dataset.shade) {
      const p = state.products.find((x) => x.id === t.dataset.shade);
      if (p) setPreviewFrom(p);
      return;
    }
    if (t.dataset.sub) {
      const active = state.app.subscription;
      if (active && active.planId === t.dataset.sub) state.app = store.cancelSubscription(state.app);
      else state.app = store.setSubscription(state.app, t.dataset.sub);
      persist(); renderSubscriptions();
      return;
    }
    if (t.dataset.inc) { state.app = store.addToCart(state.app, t.dataset.inc, 1); persist(); renderCart(); return; }
    if (t.dataset.dec) { state.app = store.addToCart(state.app, t.dataset.dec, -1); persist(); renderCart(); return; }
    if (t.dataset.rm) { state.app = store.removeFromCart(state.app, t.dataset.rm); persist(); renderCart(); return; }
    if (t.dataset.tab) { showTab(t.dataset.tab); return; }
  });

  // 필터
  $('#search').addEventListener('input', (e) => { state.filters.q = e.target.value; renderCatalog(); });
  $('#f-style').addEventListener('change', (e) => { state.filters.style = e.target.value; renderCatalog(); });
  $('#f-season').addEventListener('change', (e) => { state.filters.season = e.target.value; renderCatalog(); });
  $('#f-warm').addEventListener('change', (e) => { state.filters.warmCool = e.target.value; renderCatalog(); });
  $('#f-sort').addEventListener('change', (e) => { state.filters.sort = e.target.value; renderCatalog(); });
  $('#f-price').addEventListener('input', (e) => {
    state.filters.maxPrice = Number(e.target.value);
    $('#price-label').textContent = state.filters.maxPrice ? '~' + won(state.filters.maxPrice) : '전체';
    renderCatalog();
  });
  $('#reset-filters').addEventListener('click', () => {
    state.filters = { q: '', style: 'all', season: 'all', warmCool: 'all', maxPrice: 0, sort: 'popular' };
    $('#search').value = ''; $('#f-style').value = 'all'; $('#f-season').value = 'all';
    $('#f-warm').value = 'all'; $('#f-sort').value = 'popular'; $('#f-price').value = 0;
    $('#price-label').textContent = '전체';
    renderCatalog();
  });

  // 미리보기 스타일 토글
  $('#style-toggle').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-style]');
    if (!b) return;
    state.preview.style = b.dataset.style;
    renderPreview();
  });

  // 추천 pills
  $('#tone-pills').addEventListener('click', (e) => {
    const b = e.target.closest('.pill'); if (!b) return;
    $$('#tone-pills .pill').forEach((x) => x.classList.toggle('on', x === b));
    runRecommend();
  });
  $('#sit-pills').addEventListener('click', (e) => {
    const b = e.target.closest('.pill'); if (!b) return;
    $$('#sit-pills .pill').forEach((x) => x.classList.toggle('on', x === b));
    runRecommend();
  });

  // 장바구니 / 모달
  $('#open-cart').addEventListener('click', openCart);
  $('#close-cart').addEventListener('click', closeCart);
  $('#overlay').addEventListener('click', closeCart);
  $('#checkout-btn').addEventListener('click', mockCheckout);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  // 데이터 초기화
  $('#reset-data').addEventListener('click', () => {
    state.app = store.resetState();
    persist();
    renderCatalog(); renderWishlist(); renderCart(); renderSubscriptions(); runRecommend();
    $('#toast').textContent = '로컬 데이터를 초기화했어요';
    $('#toast').classList.add('show');
    setTimeout(() => $('#toast').classList.remove('show'), 1800);
  });
}

// ---------- 초기화 ----------
async function init() {
  try {
    await loadData();
  } catch (err) {
    $('#catalog-grid').innerHTML = '<p class="empty">데이터를 불러오지 못했어요. 로컬 서버(python -m http.server)로 실행해 주세요.</p>';
    console.error(err);
    return;
  }
  // 필터 옵션 채우기
  const styles = [...new Set(state.products.map((p) => p.style))];
  const seasons = [...new Set(state.products.map((p) => p.season))];
  $('#f-style').insertAdjacentHTML('beforeend', styles.map((s) => `<option value="${s}">${s}</option>`).join(''));
  $('#f-season').insertAdjacentHTML('beforeend', seasons.map((s) => `<option value="${s}">${s}</option>`).join(''));

  const first = state.products[0];
  state.preview = { hex: first.hex, accentHex: first.accentHex, style: first.style, name: first.name };

  wireEvents();
  wireAI();
  renderCatalog();
  renderPreview();
  renderRecommend();
  renderAI();
  renderSubscriptions();
  renderWishlist();
  renderCart();
  renderBadges();
}

init();
