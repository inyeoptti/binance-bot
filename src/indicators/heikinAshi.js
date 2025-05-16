// src/indicators/heikinAshi.js
// Heikin-Ashi 변환 함수 (ESM)
// - 입력: 일반 캔들 배열
// - 출력: ha_open, ha_high, ha_low, ha_close가 추가된 배열
// - 한글 주석 포함

/**
 * Heikin-Ashi 변환 함수
 * @param {Array} candles - 일반 캔들 배열 [{open, high, low, close, ...}]
 * @returns {Array} - Heikin-Ashi 필드가 추가된 배열
 */
export function calculateHeikinAshi(candles) {
  const result = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    let haClose = (c.open + c.high + c.low + c.close) / 4;
    let haOpen, haHigh, haLow;
    if (i === 0) {
      haOpen = (c.open + c.close) / 2;
      haHigh = c.high;
      haLow = c.low;
    } else {
      const prev = result[i - 1];
      haOpen = (prev.ha_open + prev.ha_close) / 2;
      haHigh = Math.max(c.high, haOpen, haClose);
      haLow = Math.min(c.low, haOpen, haClose);
    }
    result.push({
      ...c,
      ha_open: haOpen,
      ha_high: haHigh,
      ha_low: haLow,
      ha_close: haClose
    });
  }
  return result;
} 