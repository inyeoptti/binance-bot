// src/modules/dataFetcher.js
import ccxt from 'ccxt';
import { config } from '../config.js';

const {
  binance: { apiKey, apiSecret, apiUrl },
  trading: { symbol: SYMBOL, timeframe: TIMEFRAME }
} = config;

// CCXT 바이낸스 선물(USDC-M) 인스턴스
const exchange = new ccxt.binance({
  apiKey,
  secret: apiSecret,
  options: { defaultType: 'future' }, // USDC-마진 선물
  enableRateLimit: true,
  ...(apiUrl ? { urls: { api: { public: apiUrl, private: apiUrl } } } : {})
});

/**
 * 과거 N개 봉 데이터를 가져옵니다.
 * @param {string} symbol   ex: 'ETH/USDC'
 * @param {string} timeframe ex: '15m'
 * @param {number} limit    ex: 15 → 최신 15봉
 * @returns {Promise<Array<{ timestamp: number, open: number, high: number, low: number, close: number, volume: number }>>}
 */
export async function fetchHistorical(symbol = SYMBOL, timeframe = TIMEFRAME, limit = 100) {
  // ccxt.fetchOHLCV 반환: [ [ts, open, high, low, close, volume], ... ]
  const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  return ohlcv.map(c => ({
    timestamp: c[0],
    open:      c[1],
    high:      c[2],
    low:       c[3],
    close:     c[4],
    volume:    c[5]
  }));
}

/**
 * 가장 최근에 마감된 봉 하나를 가져옵니다.
 * @param {string} symbol   ex: 'ETH/USDC'
 * @param {string} timeframe ex: '15m'
 * @returns {Promise<{ timestamp: number, open: number, high: number, low: number, close: number, volume: number } | null>}
 */
export async function fetchLatestCandle(symbol = SYMBOL, timeframe = TIMEFRAME) {
  // limit=2로 직전 봉까지 포함해서 가져온 뒤, 마지막 요소를 리턴
  const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, 2);
  if (!ohlcv || ohlcv.length < 2) {
    return null;
  }
  const c = ohlcv[ohlcv.length - 1];
  return {
    timestamp: c[0],
    open:      c[1],
    high:      c[2],
    low:       c[3],
    close:     c[4],
    volume:    c[5]
  };
}

/**
 * 현재 계좌 USDC 잔고를 반환합니다.
 * @returns {Promise<number>} USDC 잔고 (소수)
 */
export async function fetchAccountBalance() {
  const balance = await exchange.fetchBalance();
  // USDC-M Futures 계정의 잔고는 'USDC' 필드에 있음
  const usdcInfo = balance.total.USDC ?? 0;
  return Number(usdcInfo);
}

/**
 * 최근 체결된 청산(filled) 주문을 반환합니다.
 *
 * @param {string} symbol   ex: 'ETH/USDC'
 * @returns {Promise<Array<{ tradeId: string, exitPrice: number, exitReason: string, pnl: number, durationSeconds: number, isClosed: boolean }>>}
 */
export async function fetchRecentFills(symbol = SYMBOL) {
  // ccxt.fetchMyTrades는 최근 체결 내역(진입·청산 포함)을 보여줍니다.
  // 여기서는 “positionSide”가 동일한 방향으로 두 번 체결된 이후,
  // 청산되는 트레이드를 isClosed=true로 간주하는 단순 예시입니다.
  const trades = await exchange.fetchMyTrades(symbol);
  const results = [];

  // 단순화: 각 체결을 순회하면서 fee, side 구분이 필요하나
  // 여기서는 'exitReason'을 'TAKE_PROFIT' / 'STOP_LOSS'로 채우지 않고
  // 청산된 모든 체결을 isClosed=true로 반환합니다.
  trades.forEach(trade => {
    if (trade.side === 'sell' || trade.side === 'buy') {
      // 진입 매매인지 청산 매매인지 구분하려면
      // 세부 position 정보를 추가로 조회해야 하나,
      // 간단히 모든 체결을 이전 미청산 상태 → 청산 상태로 가정
      results.push({
        tradeId:        trade.id,
        exitPrice:      trade.price,
        exitReason:     'FILLED',
        pnl:            trade.cost - trade.fee,       // 단순 계산: cost(가격×수량) - 수수료
        durationSeconds: 0,                            // duration은 별도로 추적 필요
        isClosed:       true
      });
    }
  });

  return results;
}

export default {
  fetchHistorical,
  fetchLatestCandle,
  fetchAccountBalance,
  fetchRecentFills
};
