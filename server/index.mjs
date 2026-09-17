// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — REFERENCE 백엔드 프록시 (운영자가 자신의 키로 배포).
//
// ┌────────────────────────────────────────────────────────────────────────┐
// │  ⚠️  이 저장소/CI 에서는 절대 실행하지 않는다. API 키를 넣고 돌리지 말 것.   │
// │  운영자가 자신의 인프라에 배포하고, ANTHROPIC_API_KEY 를 서버 환경변수로만   │
// │  주입한다. 키는 브라우저·프런트엔드·저장소 어디에도 존재하지 않는다.         │
// └────────────────────────────────────────────────────────────────────────┘
//
// 역할: 프런트엔드의 POST /api/ai  {task, payload}  요청을 받아
//       Claude 로 스트리밍 호출하고, 텍스트 델타를 그대로 흘려보낸다.
//       task ∈ { chat, coordi, summarize } — 글로우팁 AI 어시스턴트 3종.
//
// 무인·저비용 설계
// ----------------
//  · 비용 우선 기본 모델 claude-haiku-4-5 ($1/$5 per MTok). AI_MODEL 로 상향 가능.
//  · 프롬프트 캐싱: 태스크별 (안정적인) 시스템 프롬프트를 cache_control 블록으로 보내
//    반복 호출 시 캐시를 읽어 비용을 낮춘다.
//  · 출력 상한: 태스크별 modest max_tokens.
//  · 가드레일: IP당 분당 레이트 리밋 + 월 토큰 예산. 초과 시 429 {fallback:true}
//    → 프런트가 자동으로 내장 mock 으로 폴백(앱은 절대 멈추지 않는다, 무인).
//
// 실행(운영자 환경에서만):
//   cd server && npm install
//   ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY node index.mjs
//   (선택) AI_MODEL=claude-sonnet-5  # 품질 상향 시

import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.PORT) || 8787;
// CORS 허용 오리진(콤마 구분 아님, 단일 값). 기본은 모든 오리진. 운영 시 배포 도메인으로 좁힌다.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

// 비용 우선 기본 모델. 품질을 높이려면 AI_MODEL=claude-sonnet-5 또는 claude-opus-5.
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const EFFORT = process.env.AI_EFFORT || 'low';
// Haiku 4.5 는 adaptive thinking / effort 파라미터를 받지 않는다(보내면 400). 그래서 분기.
const IS_HAIKU = MODEL.startsWith('claude-haiku');

// ---------- 비용 가드레일 ----------
const RATE_PER_MIN = Number(process.env.AI_RATE_PER_MIN) || 20;         // IP당 분당 요청 상한
const MONTHLY_TOKEN_CAP = Number(process.env.AI_MONTHLY_TOKEN_CAP) || 2_000_000; // 월 토큰 예산

// ANTHROPIC_API_KEY 는 SDK 가 환경변수에서 자동으로 읽는다. 키는 서버에만 존재.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// task별 시스템 프롬프트(한국어). 모두 "제공된 제품 목록에만 근거"하도록 grounding.
// system 은 태스크마다 안정적이라 프롬프트 캐시 대상으로 삼는다.
const SYSTEMS = {
  chat:
    '당신은 "글로우팁" 일회용 젤 네일아트 쇼핑몰의 한국어 뷰티 어시스턴트입니다. ' +
    '사용자의 피부톤·상황·취향에 맞춰 컬러와 스타일을 친근하게 추천하세요. ' +
    '반드시 payload 에 주어진 제품 목록 안에서만 추천하고, 없는 제품·가격·효능을 지어내지 마세요. ' +
    '모든 제품·가격·리뷰는 데모용 가상 데이터임을 잊지 마세요.',
  coordi:
    '당신은 "글로우팁"의 한국어 스타일리스트입니다. 주어진 상황(situation)에 맞는 옷차림과 ' +
    '그에 어울리는 네일 컬러 코디를 제안하세요. 네일 제품은 payload 의 제품 목록 안에서만 고르세요. ' +
    '데모용 가상 데이터임을 전제로 간결하고 실용적으로 답하세요.',
  summarize:
    '당신은 한국어 상품 카피라이터입니다. 주어진 제품 설명과 고객 후기를 바탕으로 ' +
    '핵심만 담은 짧은 요약(한줄평 + 키워드 + 대표 후기)을 작성하세요. ' +
    '주어진 정보 밖의 사실을 추가하지 말고, 데모용 가상 데이터임을 전제로 하세요.',
};

// 태스크별 출력 상한(비용 절감: 필요한 만큼만).
const MAX_TOKENS = { chat: 700, coordi: 700, summarize: 500 };

function buildUserMessage(task, payload = {}) {
  if (task === 'summarize') {
    return (
      '다음 제품을 요약해 주세요.\n' +
      JSON.stringify(payload.product ?? {}, null, 2)
    );
  }
  if (task === 'coordi') {
    return (
      `상황: ${payload.situation ?? '데일리'}\n` +
      '아래 제품 목록에서만 골라 코디를 제안해 주세요.\n' +
      JSON.stringify(payload.products ?? [], null, 2)
    );
  }
  // chat
  return (
    `사용자 메시지: ${payload.message ?? ''}\n` +
    `피부톤: ${payload.warmCool ?? '지정 안 함'} / 상황: ${payload.situation ?? '지정 안 함'}\n` +
    '아래 제품 목록에서만 추천해 주세요.\n' +
    JSON.stringify(payload.products ?? [], null, 2)
  );
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error('요청 본문이 너무 큽니다.'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ---------- 레이트 리밋 (in-memory, IP당 슬라이딩 1분 창) ----------
const rateHits = new Map(); // ip -> { count, resetAt }
function allowRate(ip) {
  const now = Date.now();
  let e = rateHits.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + 60_000 }; rateHits.set(ip, e); }
  e.count += 1;
  return e.count <= RATE_PER_MIN;
}

// ---------- 월 토큰 예산 (in-memory, 달 바뀌면 리셋) ----------
let usedTokens = 0;
let budgetMonth = monthKey();
function monthKey() { const d = new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; }
function underBudget() {
  const m = monthKey();
  if (m !== budgetMonth) { budgetMonth = m; usedTokens = 0; }
  return usedTokens < MONTHLY_TOKEN_CAP;
}
function addUsage(usage) {
  if (!usage) return;
  usedTokens += (usage.input_tokens || 0) + (usage.output_tokens || 0)
    + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
}

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method !== 'POST' || !(req.url || '').startsWith('/api/ai')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  let body;
  try { body = JSON.parse((await readBody(req)) || '{}'); }
  catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request: ' + (e && e.message ? e.message : 'invalid JSON'));
    return;
  }

  const { task, payload } = body;
  const system = SYSTEMS[task];
  if (!system) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request: unknown task');
    return;
  }

  // 가드레일: 레이트 리밋 / 월 예산 초과 → 429 {fallback:true} (프런트는 mock 으로 자동 폴백)
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress || 'unknown';
  if (!allowRate(ip) || !underBudget()) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ fallback: true }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });

  try {
    // 요청 파라미터: 프롬프트 캐싱 + (Haiku 가 아닐 때만) adaptive thinking / effort.
    const params = {
      model: MODEL,
      max_tokens: MAX_TOKENS[task] || 700,
      // 안정적인 시스템 프롬프트를 캐시 블록으로 → 반복 호출 시 캐시 읽기로 비용 절감.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserMessage(task, payload) }],
    };
    if (!IS_HAIKU) {
      params.thinking = { type: 'adaptive' };
      params.output_config = { effort: EFFORT };
    }

    const stream = client.messages.stream(params);
    stream.on('text', (delta) => res.write(delta));
    const final = await stream.finalMessage();
    addUsage(final && final.usage); // 최종 메시지 usage 를 월 예산에 누적
    res.end();
  } catch (err) {
    // 헤더는 이미 전송됐으므로 스트림 말미에 오류 표시만 덧붙인다.
    if (!res.writableEnded) res.end(`\n[AI 오류] ${err && err.message ? err.message : err}`);
  }
});

server.listen(PORT, () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY 가 설정되지 않았습니다. 이 프록시는 키 없이는 동작하지 않습니다.');
  }
  console.log(`글로우팁 AI 프록시 http://localhost:${PORT}/api/ai  (model=${MODEL}, cap=${MONTHLY_TOKEN_CAP} tok/mo, rate=${RATE_PER_MIN}/min)`);
});
