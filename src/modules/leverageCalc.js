// src/modules/leverageCalc.js
import ccxt from 'ccxt';
import { ATR } from 'technicalindicators';
import { config } from '../config.js';

const {
  binance: { apiKey, apiSecret },
  trading: {
    atrPeriod,
    maxLeverage,
    useMarginRatio
  }
} = config;

// CCXT 바이낸스 선물(USDC-M) 인스턴스
const exchange = new ccxt.binance({
  apiKey,
  secret: apiSecret,
  options: { defaultType: 'future' }, // USDC-마진 선물
  enableRateLimit: true
});

/**
 * symbol, timeframe으로 ATR 기반 rawLeverage와 marginRatio 계산
 * @param {string} symbol   ex: 'ETH/USDC'
 * @param {string} timeframe ex: '15m'
 * @returns {Promise<{ leverage: number, marginRatio: number }>}
 */
export async function calcLeverage(symbol, timeframe) {
  // 1) ATR 계산에 필요한 최소봉 개수 = ATR_PERIOD + 1
  const limit = Number(atrPeriod) + 1;

  // 2) OHLCV 가져오기
  const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  // ohlcv: [ [ timestamp, open, high, low, close, volume ], ... ]
  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);
  const lastClose = closes[closes.length - 1];

  // 3) ATR 시리즈 계산
  const atrSeries = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: Number(atrPeriod)
  });
  const atr = atrSeries[atrSeries.length - 1] || 0;

  // 4) ATR 퍼센트(%) = (atr / 마지막 종가) * 100
  const atrPct = lastClose > 0 ? (atr / lastClose) * 100 : 0;

  // 5) 원시 레버리지 = RISK_PER_TRADE(=useMarginRatio) ÷ (atrPct/100)
  const rawLev = atrPct > 0
    ? Number(useMarginRatio) / (atrPct / 100)
    : Number(maxLeverage);

  // 6) 최종 레버리지 = rawLev 상한 maxLeverage
  const leverage = Math.min(rawLev, Number(maxLeverage));

  // 7) 정수 레버리지 = 올림
  const intLeverage = Math.ceil(leverage);

  // 8) 마진 비율 = leverage ÷ intLeverage
  const marginRatio = intLeverage > 0
    ? leverage / intLeverage
    : 0;

  return {
    leverage: +leverage.toFixed(2),
    marginRatio: +marginRatio.toFixed(4)
  };
}
