// src/indicators/stochrsi.js
// Stochastic RSI(K, D) 계산 함수 (ESM)
// - 입력: 캔들 배열
// - 출력: stoch_rsi_k, stoch_rsi_d 필드가 추가된 배열
// - 한글 주석 포함

import { StochasticRSI } from 'technicalindicators';

/**
 * Stochastic RSI(K, D) 계산 함수
 * @param {Array} candles - 캔들 배열 [{close, ...}]
 * @returns {Array} - stoch_rsi_k, stoch_rsi_d 필드가 추가된 배열
 */
export function calculateStochRSI(candles) {
  const closes = candles.map(c => c.close);
  const stochRSIResults = StochasticRSI.calculate({
    rsiPeriod: 14,
    stochasticPeriod: 14,
    kPeriod: 3,
    dPeriod: 3,
    values: closes
  });
  // 앞쪽 패딩(null)
  const padding = Array(closes.length - stochRSIResults.length).fill({ k: null, d: null });
  const stochRSIValues = [...padding, ...stochRSIResults];
  return candles.map((c, i) => ({
    ...c,
    stoch_rsi_k: stochRSIValues[i]?.k ?? null,
    stoch_rsi_d: stochRSIValues[i]?.d ?? null
  }));
} 