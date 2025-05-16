// src/indicators/ema.js
// EMA200 계산 함수 (ESM)
// - 입력: 일반 또는 Heikin-Ashi 캔들 배열
// - 출력: ema200 필드가 추가된 배열
// - 한글 주석 포함

import { EMA } from 'technicalindicators';

/**
 * EMA200 계산 함수
 * @param {Array} candles - 캔들 배열 [{close, ...}]
 * @returns {Array} - ema200 필드가 추가된 배열
 */
export function calculateEMA200(candles) {
  const closes = candles.map(c => c.close);
  const ema200Arr = EMA.calculate({ period: 200, values: closes });
  // 앞쪽 199개는 null로 패딩
  const padding = Array(closes.length - ema200Arr.length).fill(null);
  const ema200Values = [...padding, ...ema200Arr];
  return candles.map((c, i) => ({
    ...c,
    ema200: ema200Values[i]
  }));
} 