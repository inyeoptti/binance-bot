// src/db/candlePipeline.js
// 캔들 데이터 통합 파이프라인 (ESM)
// - 원본 캔들 배열을 받아 Heikin-Ashi, EMA200, StochRSI 계산 후 DB에 저장
// - 한글 주석 포함

import { calculateHeikinAshi } from '../indicators/heikinAshi.js';
import { calculateEMA200 } from '../indicators/ema.js';
import { calculateStochRSI } from '../indicators/stochrsi.js';
import * as candleDAO from './candle.js';

/**
 * 바이낸스 원본 캔들 배열을 받아
 * 1. Heikin-Ashi 변환
 * 2. EMA200 계산
 * 3. StochRSI 계산
 * 4. DB에 순차 저장(upsert)
 * @param {Array} candles - [{timestamp, open, high, low, close, volume, ...}]
 * @param {string} timeframe - '1m', '15m' 등
 */
export async function processAndStoreCandles(candles, timeframe) {
  try {
    // 1. Heikin-Ashi 변환
    let haCandles = calculateHeikinAshi(candles);
    // 2. EMA200 계산 (Heikin-Ashi close 기준)
    haCandles = haCandles.map((c, i, arr) => ({ ...c, close: c.ha_close }));
    let emaCandles = calculateEMA200(haCandles);
    // 3. StochRSI 계산 (Heikin-Ashi close 기준)
    let stochCandles = calculateStochRSI(emaCandles);
    // 4. DB에 저장 (upsert)
    for (const c of stochCandles) {
      await candleDAO.upsertCandle({
        timestamp: c.timestamp,
        timeframe,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        ha_open: c.ha_open,
        ha_high: c.ha_high,
        ha_low: c.ha_low,
        ha_close: c.ha_close,
        ema200: c.ema200,
        stoch_rsi_k: c.stoch_rsi_k,
        stoch_rsi_d: c.stoch_rsi_d
      });
    }
    console.log(`[캔들 저장] ${timeframe} ${candles.length}개 저장 완료`);
  } catch (err) {
    console.error('[캔들 파이프라인 오류]', err);
  }
} 