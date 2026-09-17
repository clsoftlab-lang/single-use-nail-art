// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

// 플러그형 AI 레이어.
//
// askAI(task, payload, { onToken }) 하나로 세 가지 AI 기능을 처리합니다.
//   - AI_ENDPOINT 가 비어 있으면  → 결정론적 한국어 MockProvider (앱 제품 + 추천 엔진 재사용)
//   - AI_ENDPOINT 가 설정돼 있으면 → 백엔드(server/)로 POST 후 응답을 스트리밍
//
// 브라우저/저장소에는 어떤 API 키도 두지 않습니다. 실 AI 호출은 항상 백엔드 프록시를 경유합니다.

import { AI_ENDPOINT } from './config.js';
import { shadeRecommend, situationCopy } from '../modules/recommend.js';

const won = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';
const toneLabel = (wc) => (wc === '웜' ? '웜톤' : wc === '쿨' ? '쿨톤' : '모든 톤');

// payload.message 자유 텍스트에서 톤/상황 힌트를 추출 (셀렉트로 명시된 값이 우선).
function inferFromMessage(message = '') {
  const m = String(message);
  let warmCool;
  if (/웜|따뜻|warm/i.test(m)) warmCool = '웜';
  else if (/쿨|시원|cool/i.test(m)) warmCool = '쿨';
  let situation;
  for (const s of ['웨딩', '파티', '데이트', '오피스', '데일리']) {
    if (m.includes(s)) { situation = s; break; }
  }
  return { warmCool, situation };
}

function pick(products, opts, limit) {
  return shadeRecommend(Array.isArray(products) ? products : [], { ...opts, limit });
}

function fmtItem(p, i) {
  const bits = [p.style, p.season, `${toneLabel(p.warmCool)}`].filter(Boolean).join(' · ');
  return `${i + 1}. ${p.name} (${bits}) — ${won(p.price)}\n   ${p.desc || ''}`;
}

// ---------- MockProvider (task별 결정론적 한국어 응답) ----------

function mockChat(payload = {}) {
  const { message = '', products = [] } = payload;
  const hint = inferFromMessage(message);
  const warmCool = payload.warmCool || hint.warmCool;
  const situation = payload.situation || hint.situation;
  const picks = pick(products, { warmCool, situation }, 3);
  if (!picks.length) {
    return '지금은 추천할 제품 정보를 불러오지 못했어요. 카탈로그를 먼저 열어본 뒤 다시 시도해 주세요.';
  }
  const cond = [warmCool ? toneLabel(warmCool) : null, situation ? `${situation} 상황` : null]
    .filter(Boolean).join(' · ') || '취향';
  const lines = [
    `${cond}에 어울리는 글로우팁 컬러 3가지를 골라봤어요 ✨`,
    '',
    ...picks.map(fmtItem),
    '',
    situation ? situationCopy(situation) : '',
    '마음에 드는 컬러는 "미리보기에 적용"으로 손톱에 바로 올려볼 수 있어요.',
  ].filter((l) => l !== undefined);
  return lines.join('\n').trim();
}

function mockCoordi(payload = {}) {
  const { situation = '데일리', products = [] } = payload;
  const picks = pick(products, { situation }, 2);
  const outfit = {
    데일리: '편안한 니트와 데님, 캔버스 스니커즈',
    오피스: '단정한 셔츠와 슬랙스, 로퍼',
    데이트: '러블리한 원피스와 카디건',
    파티: '반짝이는 새틴 드레스와 힐',
    웨딩: '우아한 드레스 또는 정장 하객룩',
  }[situation] || '오늘의 무드에 맞춘 룩';
  const head = `[${situation}] 코디 제안 — ${situationCopy(situation)}`;
  const body = picks.length
    ? picks.map((p, i) =>
        `· ${outfit}에는 ${p.name}(${p.style})를 매치해 보세요. ${p.hex} 발색이 포인트가 됩니다.`
        + (i === 0 ? '' : '')
      ).join('\n')
    : `· ${outfit}에 어울리는 컬러를 카탈로그에서 골라보세요.`;
  const tip = picks[0]
    ? `\n\n💡 팁: 가방·주얼리를 ${picks[0].warmCool === '웜' ? '골드' : '실버'} 톤으로 맞추면 네일과 통일감이 살아나요.`
    : '';
  return `${head}\n${body}${tip}`;
}

function mockSummarize(payload = {}) {
  const p = payload.product || {};
  const reviews = Array.isArray(p.reviews) ? p.reviews : [];
  const avg = reviews.length
    ? (reviews.reduce((a, r) => a + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
    : (p.rating != null ? String(p.rating) : '-');
  const keywords = (p.tags || []).slice(0, 3).join(', ');
  const highlight = reviews[0] ? `“${String(reviews[0].text).slice(0, 40)}...”` : '리뷰 준비 중이에요.';
  return [
    `[AI 요약] ${p.name || '이 제품'}`,
    `한줄평: ${p.desc || '가상의 데모 제품입니다.'}`,
    keywords ? `키워드: ${keywords}` : '',
    `스타일: ${[p.style, p.season, toneLabel(p.warmCool)].filter(Boolean).join(' · ')}`,
    `고객 평점: ★ ${avg}${p.reviewCount != null ? ` (${p.reviewCount} 리뷰)` : ''}`,
    `대표 후기: ${highlight}`,
  ].filter(Boolean).join('\n');
}

const MOCK = { chat: mockChat, coordi: mockCoordi, summarize: mockSummarize };

// 목업 응답도 실제 스트리밍처럼 조금씩 흘려보냅니다(onToken 제공 시).
async function streamMock(text, onToken) {
  if (typeof onToken !== 'function') return text;
  const chunks = text.match(/[\s\S]{1,3}/g) || [];
  for (const c of chunks) {
    onToken(c);
    await new Promise((r) => setTimeout(r, 12));
  }
  return text;
}

/**
 * 단일 진입점.
 * @param {'chat'|'coordi'|'summarize'} task
 * @param {Object} payload - task별 입력 (products, message, situation, product ...)
 * @param {{ onToken?: (chunk: string) => void }} [opts]
 * @returns {Promise<string>} 전체 응답 텍스트
 */
export async function askAI(task, payload = {}, { onToken } = {}) {
  // 데모 모드: 백엔드 없이 결정론적 목업.
  if (!AI_ENDPOINT) {
    const fn = MOCK[task] || (() => '지원하지 않는 AI 요청이에요.');
    return streamMock(fn(payload), onToken);
  }

  // 실 AI 모드: 백엔드 프록시로 POST 후 텍스트 스트림 수신.
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, payload }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`AI 서버 응답 오류 (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    if (typeof onToken === 'function') onToken(chunk);
  }
  return full;
}
