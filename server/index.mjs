// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

// 글로우팁 AI 백엔드 프록시.
//
// 브라우저는 절대 Anthropic API 키를 볼 수 없습니다. 프런트엔드가 이 서버의
// POST /api/ai 로 { task, payload } 를 보내면, 이 서버가 서버 측 키
// (process.env.ANTHROPIC_API_KEY)로 Claude 를 호출하고 응답을 텍스트로 스트리밍합니다.
//
// 실행:
//   cd server && npm install && ANTHROPIC_API_KEY=... npm start
// 그런 다음 ai/config.js 의 AI_ENDPOINT 를 http://localhost:8787/api/ai 로 설정하세요.

import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.PORT) || 8787;
const MODEL = 'claude-opus-5';

// ANTHROPIC_API_KEY 는 SDK 가 환경변수에서 자동으로 읽습니다. 키는 서버에만 존재합니다.
const client = new Anthropic();

// task별 시스템 프롬프트(한국어). 모두 "제공된 제품 목록에만 근거"하도록 grounding.
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

const server = http.createServer(async (req, res) => {
  // CORS (데모: 모든 오리진 허용). 운영에서는 허용 도메인을 좁히세요.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST' || !(req.url || '').startsWith('/api/ai')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  try {
    const body = await readBody(req);
    const { task, payload } = JSON.parse(body || '{}');
    const system = SYSTEMS[task] || SYSTEMS.chat;
    const messages = [{ role: 'user', content: buildUserMessage(task, payload) }];

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    });

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      system,
      messages,
    });
    stream.on('text', (delta) => res.write(delta));
    await stream.finalMessage();
    res.end();
  } catch (err) {
    const msg = 'AI 서버 오류: ' + (err && err.message ? err.message : 'unknown');
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end(msg);
  }
});

server.listen(PORT, () => {
  console.log(`글로우팁 AI 프록시가 http://localhost:${PORT}/api/ai 에서 대기 중 (model: ${MODEL})`);
});
