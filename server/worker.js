// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/worker.js — Cloudflare Workers 변형 (무인·무서버·프리티어).
//
// index.mjs 와 동일한 태스크 라우팅 / 모델 / 프롬프트 캐싱 규칙을 그대로 쓰되,
// Node SDK 대신 Anthropic REST(POST /v1/messages)를 직접 호출한다.
// 서버를 직접 돌보지 않아도 되는 무료 배포 경로.
//
// 키는 Worker 시크릿으로만 존재한다(브라우저·저장소 어디에도 없음):
//   wrangler secret put ANTHROPIC_API_KEY
// 배포:
//   cd server && wrangler deploy
// 그런 다음 ../ai/config.js 의 AI_ENDPOINT 를 이 워커 URL(+ /api/ai)로 설정.

// task별 시스템 프롬프트 (index.mjs 와 동일 grounding 규칙).
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

const MAX_TOKENS = { chat: 700, coordi: 700, summarize: 500 };

function buildUserMessage(task, payload = {}) {
  if (task === 'summarize') {
    return '다음 제품을 요약해 주세요.\n' + JSON.stringify(payload.product ?? {}, null, 2);
  }
  if (task === 'coordi') {
    return (
      `상황: ${payload.situation ?? '데일리'}\n` +
      '아래 제품 목록에서만 골라 코디를 제안해 주세요.\n' +
      JSON.stringify(payload.products ?? [], null, 2)
    );
  }
  return (
    `사용자 메시지: ${payload.message ?? ''}\n` +
    `피부톤: ${payload.warmCool ?? '지정 안 함'} / 상황: ${payload.situation ?? '지정 안 함'}\n` +
    '아래 제품 목록에서만 추천해 주세요.\n' +
    JSON.stringify(payload.products ?? [], null, 2)
  );
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': (env && env.ALLOW_ORIGIN) || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.startsWith('/api/ai')) {
      return new Response('Not Found', { status: 404, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response('Bad Request', { status: 400, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } }); }

    const system = SYSTEMS[body.task];
    if (!system) {
      return new Response('Bad Request: unknown task', { status: 400, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // 비용 우선 기본 모델. AI_MODEL 로 상향 가능(claude-sonnet-5 / claude-opus-5).
    const MODEL = (env && env.AI_MODEL) || 'claude-haiku-4-5';
    const IS_HAIKU = MODEL.startsWith('claude-haiku');

    const payload = {
      model: MODEL,
      max_tokens: MAX_TOKENS[body.task] || 700,
      // 프롬프트 캐싱: 안정적인 system 을 캐시 블록으로 → 반복 호출 시 비용 절감.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserMessage(body.task, body.payload) }],
    };
    if (!IS_HAIKU) {
      // Haiku 4.5 는 adaptive thinking / effort 를 받지 않는다(보내면 400). 그 외 모델만 적용.
      payload.thinking = { type: 'adaptive' };
      payload.output_config = { effort: (env && env.AI_EFFORT) || 'low' };
    }

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        // 어떤 이유로든 실패 → 프런트가 mock 으로 폴백하도록 429 {fallback:true}.
        return new Response(JSON.stringify({ fallback: true }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      const data = await r.json();
      const text = ((data && data.content) || [])
        .filter((b) => b && b.type === 'text')
        .map((b) => b.text)
        .join('');
      return new Response(text, { status: 200, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
    } catch {
      return new Response(JSON.stringify({ fallback: true }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  },
};
