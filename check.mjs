// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

// 빌드 없는 정적 사이트 검증 스크립트.
// - data/*.json 파싱
// - 모든 JS를 node --check
// - index.html 필수 컨테이너 존재 확인
// - 순수 헬퍼(shadeRecommend) 단위 테스트

import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const root = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => { console.error('  ✗ ' + m); failed++; };

// 1) JSON 파싱
console.log('[1] data/*.json 파싱');
const dataDir = join(root, 'data');
let products = [];
for (const f of readdirSync(dataDir).filter((x) => x.endsWith('.json'))) {
  try {
    const obj = JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
    ok(`${f} 파싱 성공`);
    if (obj.products) products = obj.products;
  } catch (e) {
    fail(`${f} 파싱 실패: ${e.message}`);
  }
}
if (products.length >= 30) ok(`제품 ${products.length}개 (>= 30)`);
else fail(`제품 ${products.length}개 (30개 미만)`);

// 제품 스키마 최소 검증
const required = ['id', 'name', 'hex', 'style', 'season', 'price', 'components', 'steps', 'reviews'];
let schemaOk = true;
for (const p of products) {
  for (const k of required) {
    if (!(k in p)) { schemaOk = false; fail(`제품 ${p.id || '?'} 필드 누락: ${k}`); break; }
  }
}
if (schemaOk) ok('모든 제품 필수 필드 보유');

// 2) node --check 모든 JS
console.log('[2] node --check (모든 .js/.mjs)');
function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(full));
    else if (/\.(mjs|js)$/.test(e.name)) out.push(full);
  }
  return out;
}
for (const jsFile of walk(root)) {
  try {
    execFileSync(process.execPath, ['--check', jsFile], { stdio: 'pipe' });
    ok(`--check ${jsFile.replace(root, '.')}`);
  } catch (e) {
    fail(`--check 실패 ${jsFile.replace(root, '.')}: ${e.message}`);
  }
}

// 3) index.html 필수 컨테이너
console.log('[3] index.html 컨테이너');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const ids = [
  'catalog-grid', 'search', 'f-style', 'f-season', 'f-warm', 'f-sort', 'f-price',
  'preview-stage', 'shade-chips', 'style-toggle', 'preview-name',
  'tone-pills', 'sit-pills', 'recommend-grid',
  'subscription-grid', 'wishlist-grid',
  'cart-drawer', 'cart-body', 'cart-total', 'checkout-btn', 'modal', 'modal-body', 'toast',
];
for (const id of ids) {
  if (html.includes(`id="${id}"`)) ok(`#${id} 존재`);
  else fail(`#${id} 누락`);
}
if (html.includes('type="module"')) ok('ES module 스크립트 로드');
else fail('module 스크립트 누락');

// 4) 순수 헬퍼 단위 테스트
console.log('[4] shadeRecommend 단위 테스트');
const { shadeRecommend, situationCopy } = await import('./modules/recommend.js');
try {
  const sample = [
    { id: 'a', warmCool: '웜', vibe: ['파티'], rating: 4.0 },
    { id: 'b', warmCool: '쿨', vibe: ['오피스'], rating: 5.0 },
    { id: 'c', warmCool: '웜', vibe: ['데일리'], rating: 3.0 },
  ];
  // 웜 + 파티 → a가 최상위 (warmCool 3 + vibe 4 + 2 = 9)
  const r1 = shadeRecommend(sample, { warmCool: '웜', situation: '파티' });
  assert.equal(r1[0].id, 'a', '웜+파티 최상위는 a');
  ok('웜+파티 → a 최상위');

  // limit 적용
  const r2 = shadeRecommend(sample, { warmCool: '웜', limit: 1 });
  assert.equal(r2.length, 1, 'limit=1 이면 1개');
  ok('limit 정상 동작');

  // 빈/비배열 입력 방어
  assert.deepEqual(shadeRecommend(null), [], 'null 입력 → []');
  assert.deepEqual(shadeRecommend(undefined), [], 'undefined 입력 → []');
  ok('잘못된 입력 방어');

  // 원본 불변 (score 필드가 원본에 새지 않음)
  assert.ok(!('score' in sample[0]), '원본 객체 불변');
  ok('원본 불변성 유지');

  // score 필드 부여 확인
  assert.ok(typeof r1[0].score === 'number', 'score 숫자');
  ok('score 필드 부여');

  // situationCopy
  assert.ok(situationCopy('파티').length > 0, 'situationCopy 반환');
  assert.ok(situationCopy('없는상황').length > 0, 'situationCopy 폴백');
  ok('situationCopy 정상');
} catch (e) {
  fail('단위 테스트 실패: ' + e.message);
}

// 5) AI 레이어 검증
console.log('[5] AI 레이어 (ai/ + server/)');
// 5a) ai/ 와 server/ 의 모든 스크립트 node --check
const aiTargets = [];
for (const sub of ['ai', 'server']) {
  const dir = join(root, sub);
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { fail(`${sub}/ 디렉터리 없음`); continue; }
  for (const e of entries) {
    if (/\.(mjs|js)$/.test(e.name)) aiTargets.push(join(dir, e.name));
  }
}
for (const f of aiTargets) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    ok(`--check ${f.replace(root, '.')}`);
  } catch (e) {
    fail(`--check 실패 ${f.replace(root, '.')}: ${e.message}`);
  }
}
if (aiTargets.some((f) => f.endsWith('config.js'))) ok('ai/config.js 존재');
else fail('ai/config.js 누락');
if (aiTargets.some((f) => f.endsWith('ai.js'))) ok('ai/ai.js 존재');
else fail('ai/ai.js 누락');
if (aiTargets.some((f) => f.endsWith('index.mjs'))) ok('server/index.mjs 존재');
else fail('server/index.mjs 누락');

// 5b) AI_ENDPOINT 는 리포지토리에서 비어 있어야 함(데모=mock, 커밋 안전)
try {
  const { AI_ENDPOINT } = await import('./ai/config.js');
  if (AI_ENDPOINT === '') ok('AI_ENDPOINT 비어 있음 (데모=mock)');
  else fail(`AI_ENDPOINT 가 비어 있지 않음: "${AI_ENDPOINT}" (커밋 전 "" 로 되돌리세요)`);
} catch (e) {
  fail('ai/config.js import 실패: ' + e.message);
}

// 5c) 실제 API 키 형식이 리포지토리에 새어 들어갔는지 스캔 (문자열 결합으로 자기 자신 매치 방지)
const keyRe = new RegExp('sk-' + 'ant-[A-Za-z0-9_-]{20,}');
function walkAll(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkAll(full));
    else if (/\.(mjs|js|json|md|css|html|yml|yaml|toml|txt|example|env)$/.test(e.name)) out.push(full);
  }
  return out;
}
let leaked = 0;
for (const f of walkAll(root)) {
  let text = '';
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  if (keyRe.test(text)) { fail(`API 키 형식 노출 의심: ${f.replace(root, '.')}`); leaked++; }
}
if (!leaked) ok('실제 API 키 형식 미검출');

// 5d) .env 가 .gitignore 로 제외되는지
try {
  const gi = readFileSync(join(root, '.gitignore'), 'utf8');
  if (/(^|\n)\s*\.env\s*(\n|$)/.test(gi) || /(^|\n)\s*\*\.env\s*(\n|$)/.test(gi)) ok('.gitignore 가 .env 제외');
  else fail('.gitignore 에 .env 제외 규칙 없음');
} catch (e) {
  fail('.gitignore 읽기 실패: ' + e.message);
}

console.log('');
if (failed) { console.error(`❌ 실패 ${failed}건`); process.exit(1); }
console.log('✅ 모든 검증 통과');
