// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)

// AI 백엔드 엔드포인트 설정.
//
// 비어 있으면(기본값) 프런트엔드는 결정론적 한국어 MockProvider로 동작합니다.
// 실제 Claude 연동을 켜려면 server/ 백엔드를 띄운 뒤 그 주소를 여기에 넣으세요.
//   예: export const AI_ENDPOINT = "http://localhost:8787/api/ai";
//
// ⚠️ 여기에는 절대 API 키를 넣지 마세요. 키는 백엔드(server/)에서만 다룹니다.
export const AI_ENDPOINT = "";
