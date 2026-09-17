// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

// 손 모양 inline-SVG를 생성하고, 선택한 컬러/스타일로 손톱을 다시 칠합니다.
// 바이너리 없음 — 순수 SVG 마크업만 반환.

/**
 * 스타일별 손톱 오버레이(장식)를 반환.
 * @param {string} style - 글리터|큐빅|프렌치|무광
 * @param {number} cx - 손톱 중심 x
 * @param {number} topY - 손톱 상단 y
 * @param {number} w - 손톱 폭
 * @param {string} accent - 강조색
 * @param {number} i - 손가락 인덱스(패턴 id 유일화용)
 * @returns {string}
 */
function styleOverlay(style, cx, topY, w, accent, i) {
  const half = w / 2;
  if (style === '프렌치') {
    return `<path d="M ${cx - half} ${topY + 6} Q ${cx} ${topY - 4} ${cx + half} ${topY + 6} L ${cx + half} ${topY + 1} Q ${cx} ${topY - 7} ${cx - half} ${topY + 1} Z" fill="${accent}" opacity="0.95"/>`;
  }
  if (style === '글리터') {
    const dots = [];
    for (let k = 0; k < 7; k++) {
      const dx = cx - half + Math.random() * w;
      const dy = topY + 4 + Math.random() * (w * 1.6);
      const r = 0.7 + Math.random() * 1.1;
      dots.push(`<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${r.toFixed(1)}" fill="${accent}" opacity="0.9"/>`);
    }
    return dots.join('');
  }
  if (style === '큐빅') {
    // 반짝이는 큐빅(마름모) 3개
    const gem = (gx, gy, s) =>
      `<path d="M ${gx} ${gy - s} L ${gx + s} ${gy} L ${gx} ${gy + s} L ${gx - s} ${gy} Z" fill="${accent}" stroke="#ffffff" stroke-width="0.4" opacity="0.95"/>`;
    return gem(cx, topY + 8, 2.6) + gem(cx - 3.4, topY + 13, 1.8) + gem(cx + 3.4, topY + 13, 1.8);
  }
  // 무광: 매트 필터 느낌의 미세 반투명 레이어
  return `<rect x="${cx - half}" y="${topY}" width="${w}" height="${w * 2.1}" rx="${half}" fill="#000000" opacity="0.06"/>`;
}

/**
 * 손 SVG 문자열 생성.
 * @param {Object} opts - { hex, accentHex, style }
 * @returns {string} SVG markup
 */
export function renderHandSVG(opts = {}) {
  const hex = opts.hex || '#e6789a';
  const accent = opts.accentHex || '#ffffff';
  const style = opts.style || '무광';
  const glossy = style !== '무광';

  // 손가락 5개: [손톱중심x, 손톱상단y, 손톱폭, 손가락 길이]
  const fingers = [
    { cx: 42, topY: 150, w: 15, len: 70, base: 150 }, // 엄지(측면)
    { cx: 78, topY: 60, w: 16, len: 120, base: 60 },
    { cx: 108, topY: 42, w: 17, len: 140, base: 42 },
    { cx: 138, topY: 56, w: 16, len: 126, base: 56 },
    { cx: 166, topY: 84, w: 14, len: 100, base: 84 },
  ];

  let fingerShapes = '';
  let nails = '';
  fingers.forEach((f, i) => {
    const half = f.w / 2;
    // 손가락 (라운드 rect)
    fingerShapes += `<rect x="${f.cx - half}" y="${f.topY}" width="${f.w}" height="${f.len}" rx="${half}" fill="var(--skin)"/>`;
    // 손톱 (타원형)
    const nailH = f.w * 2.1;
    nails += `<g>`;
    nails += `<rect x="${f.cx - half}" y="${f.topY}" width="${f.w}" height="${nailH}" rx="${half}" fill="${hex}"/>`;
    if (glossy) {
      nails += `<rect x="${f.cx - half + 1.5}" y="${f.topY + 2}" width="${f.w * 0.35}" height="${nailH * 0.55}" rx="2" fill="#ffffff" opacity="0.25"/>`;
    }
    nails += styleOverlay(style, f.cx, f.topY, f.w, accent, i);
    nails += `</g>`;
  });

  // 손바닥
  const palm = `<path d="M 30 150 Q 25 235 70 250 L 165 250 Q 195 235 185 160 L 175 150 Q 150 175 108 172 Q 66 175 42 150 Z" fill="var(--skin)"/>`;

  return `<svg viewBox="0 0 210 270" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="선택한 컬러가 적용된 손 미리보기" class="hand-svg">
    <style>
      .hand-svg { --skin: #f0c9a8; }
      @media (prefers-color-scheme: dark) { .hand-svg { --skin: #d9ad86; } }
    </style>
    ${palm}
    ${fingerShapes}
    ${nails}
  </svg>`;
}
