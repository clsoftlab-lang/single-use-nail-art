// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

// localStorage 기반 상태 저장소. try/catch + reset 지원.
// DEMO-MODE: 실제 DB가 아니라 브라우저 로컬 저장소만 사용합니다.

const KEY = 'sun_nail_state_v1';

const DEFAULT_STATE = {
  cart: {},        // { productId: qty }
  wishlist: [],    // [productId]
  subscription: null, // { planId, startedAt }
};

function safeParse(raw) {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return {
      cart: obj.cart && typeof obj.cart === 'object' ? obj.cart : {},
      wishlist: Array.isArray(obj.wishlist) ? obj.wishlist : [],
      subscription: obj.subscription || null,
    };
  } catch {
    return null;
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return safeParse(raw) || structuredClone(DEFAULT_STATE);
  } catch {
    // 프라이빗 모드 등 localStorage 접근 불가 시 기본 상태로 동작
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function resetState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
  return structuredClone(DEFAULT_STATE);
}

// --- 장바구니 ---
export function addToCart(state, id, qty = 1) {
  const next = { ...state, cart: { ...state.cart } };
  next.cart[id] = (next.cart[id] || 0) + qty;
  if (next.cart[id] < 1) delete next.cart[id];
  return next;
}

export function setCartQty(state, id, qty) {
  const next = { ...state, cart: { ...state.cart } };
  if (qty < 1) delete next.cart[id];
  else next.cart[id] = qty;
  return next;
}

export function removeFromCart(state, id) {
  const next = { ...state, cart: { ...state.cart } };
  delete next.cart[id];
  return next;
}

export function clearCart(state) {
  return { ...state, cart: {} };
}

// --- 찜 ---
export function toggleWishlist(state, id) {
  const has = state.wishlist.includes(id);
  const wishlist = has
    ? state.wishlist.filter((x) => x !== id)
    : [...state.wishlist, id];
  return { ...state, wishlist };
}

// --- 구독 ---
export function setSubscription(state, planId) {
  return { ...state, subscription: { planId, startedAt: new Date().toISOString() } };
}

export function cancelSubscription(state) {
  return { ...state, subscription: null };
}

// --- 파생 계산 (순수) ---
export function cartCount(state) {
  return Object.values(state.cart).reduce((a, b) => a + b, 0);
}

export function cartTotal(state, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  return Object.entries(state.cart).reduce((sum, [id, qty]) => {
    const p = byId.get(id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}
