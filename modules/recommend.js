// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

/**
 * 순수 함수: 피부톤(웜/쿨)과 상황(vibe)에 따라 제품 점수를 매겨 정렬.
 * pure helper — no DOM, no globals. Unit-tested in check.mjs.
 *
 * @param {Array<Object>} products - 제품 목록
 * @param {Object} opts - { warmCool?: '웜'|'쿨', situation?: string, limit?: number }
 * @returns {Array<Object>} 점수 내림차순 정렬된 제품 (score 필드 부여)
 */
export function shadeRecommend(products, opts = {}) {
  if (!Array.isArray(products)) return [];
  const { warmCool, situation, limit } = opts;
  const scored = products.map((p) => {
    let score = 0;
    if (warmCool && p.warmCool === warmCool) score += 3;
    if (situation && Array.isArray(p.vibe) && p.vibe.includes(situation)) score += 4;
    // 평점을 미세 가중치로 반영 (동점 시 우선순위)
    score += (Number(p.rating) || 0) * 0.5;
    return { ...p, score: Math.round(score * 100) / 100 };
  });
  scored.sort((a, b) => b.score - a.score || (b.rating || 0) - (a.rating || 0));
  return typeof limit === 'number' && limit > 0 ? scored.slice(0, limit) : scored;
}

/**
 * 상황 라벨 → 대표 문구 (UI 보조용, 순수 함수)
 * @param {string} situation
 * @returns {string}
 */
export function situationCopy(situation) {
  const map = {
    데일리: '매일 손에 어울리는 편안한 컬러',
    오피스: '단정하고 프로페셔널한 컬러',
    데이트: '설레는 분위기를 더하는 컬러',
    파티: '시선을 사로잡는 화려한 컬러',
    웨딩: '특별한 날을 빛내는 우아한 컬러',
  };
  return map[situation] || '당신에게 어울리는 컬러';
}
