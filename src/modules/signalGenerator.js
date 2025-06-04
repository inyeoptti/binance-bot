// src/modules/signalGenerator.js
import { EMA, RSI, SMA } from 'technicalindicators';
import { config } from '../config.js';

const {
    trading: {
        atrPeriod,         // 사용되지 않지만, config 구조와 일관성을 위해 추출
        bbPeriod,          // 사용되지 않지만, config 구조와 일관성을 위해 추출
        bbStdMultiplier,   // 사용되지 않지만, config 구조와 일관성을 위해 추출
        useMarginRatio,    // 사용되지 않지만, config 구조와 일관성을 위해 추출
        symbol: SYMBOL,    // 모듈 내 기본 심볼(실제 호출 시 파라미터로 덮어쓰기도 가능)
        timeframe: INTERVAL,// 모듈 내 기본 타임프레임(실제 호출 시 파라미터로 덮어쓰기도 가능)
        emaPeriod,         // .env에서 읽어온 EMA 기간
        tpPct,             // .env에서 읽어온 TP 퍼센트
        slPct              // .env에서 읽어온 SL 퍼센트
    }
} = config;

// StochRSI 파라미터 (고정)
const RSI_PERIOD = 19;
const STOCH_RSI_PERIOD = 19;
const STOCH_SMOOTH_K = 3;
const STOCH_SMOOTH_D = 4;

/**
 * candles: [{ timestamp, open, high, low, close, volume }, ...]
 * return null 또는 { side, entryPrice, tpPct, slPct }
 */
export function generateSignal(candles) {
    if (!Array.isArray(candles) || candles.length < RSI_PERIOD + STOCH_RSI_PERIOD + STOCH_SMOOTH_D) {
        return null;
    }

    // 1) close, high, low 시리즈 분리
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // 2) EMA(종가, emaPeriod) 시리즈 계산 → 마지막 값 확인
    const emaValues = EMA.calculate({ period: Number(emaPeriod), values: closes });
    if (emaValues.length === 0) return null;
    const emaLast = emaValues[emaValues.length - 1];
    const price = closes[closes.length - 1];

    // 3) RSI 시리즈 계산
    const rsiValues = RSI.calculate({ period: RSI_PERIOD, values: closes });
    if (rsiValues.length < STOCH_RSI_PERIOD) return null;

    // 4) StochRSI 시리즈 계산
    const stochRsiValues = [];
    for (let i = STOCH_RSI_PERIOD - 1; i < rsiValues.length; i++) {
        const windowSlice = rsiValues.slice(i - (STOCH_RSI_PERIOD - 1), i + 1);
        const lowestRsi = Math.min(...windowSlice);
        const highestRsi = Math.max(...windowSlice);
        const currRsi = rsiValues[i];
        const denom = highestRsi - lowestRsi || 1e-9;
        stochRsiValues.push((currRsi - lowestRsi) / denom);
    }
    if (stochRsiValues.length < STOCH_SMOOTH_K + STOCH_SMOOTH_D) return null;

    // 5) %K = SMA(stochRsiValues, STOCH_SMOOTH_K)
    const kValues = SMA.calculate({ period: STOCH_SMOOTH_K, values: stochRsiValues });
    if (kValues.length < STOCH_SMOOTH_D + 1) return null;

    // 6) %D = SMA(kValues, STOCH_SMOOTH_D)
    const dValues = SMA.calculate({ period: STOCH_SMOOTH_D, values: kValues });
    if (dValues.length < 2) return null;

    // 7) 최신 %K, %D와 바로 전 %K, %D 값
    const kLast = kValues[kValues.length - 1];
    const dLast = dValues[dValues.length - 1];
    const kPrev = kValues[kValues.length - 2];
    const dPrev = dValues[dValues.length - 2];

    // 8) 교차 감지 및 조건
    const emaAbove = price > emaLast;
    const emaBelow = price < emaLast;
    const crossedUp = kPrev < dPrev && kLast > dLast;
    const crossedDown = kPrev > dPrev && kLast < dLast;

    // 9) 과매도/과매수 레벨 확인
    const isOversold = kLast < 0.2;
    const isOverbought = kLast > 0.8;

    // 10) 최종 신호 결정
    if (emaAbove && crossedUp && isOversold) {
        return {
            side: 'LONG',
            entryPrice: price,
            tpPct: Number(tpPct),
            slPct: Number(slPct)
        };
    }
    if (emaBelow && crossedDown && isOverbought) {
        return {
            side: 'SHORT',
            entryPrice: price,
            tpPct: Number(tpPct),
            slPct: Number(slPct)
        };
    }

    return null;
}
