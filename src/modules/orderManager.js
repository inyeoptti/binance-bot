// src/modules/orderManager.js
import ccxt from 'ccxt';
import { config } from '../config.js';

const {
  binance: { apiKey, apiSecret, apiUrl }
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
 * 시장가 진입 후 브래킷 주문(익절, 손절) 생성
 * @param {Object} params
 * @param {string} params.symbol   ex: 'ETH/USDC'
 * @param {'LONG'|'SHORT'} params.side
 * @param {number} params.qty      진입 수량 (기본 통화 단위)
 * @param {number} params.entryPrice 진입 가격
 * @param {number} params.leverage 레버리지(정수)
 * @param {number} params.tpPct    익절 퍼센트 (예: 0.0785)
 * @param {number} params.slPct    손절 퍼센트 (예: 0.0257)
 * @returns {Promise<{ entryOrder: object, tpOrder: object, slOrder: object }>} 주문 정보
 */
export async function openPosition({ symbol, side, qty, entryPrice, leverage, tpPct, slPct }) {
  // 1) 포지션 모드(격리 모드) 설정 (선택 사항)
  try {
    await exchange.fapiPrivate_post_positionMargin({
      symbol: symbol.replace('/', ''),
      positionSide: side,
      marginType: 'ISOLATED'
    });
    await exchange.fapiPrivate_post_leverage({
      symbol: symbol.replace('/', ''),
      leverage
    });
  } catch (e) {
    // 이미 설정되어 있거나 에러 무시
  }

  // 2) 시장가 진입
  const entryOrder = await exchange.createOrder(
    symbol,
    'market',
    side === 'LONG' ? 'buy' : 'sell',
    qty,
    undefined,
    {
      positionSide: side,
      reduceOnly: false
    }
  );

  // 3) 손절가 및 익절가 계산
  const tpPrice = side === 'LONG'
    ? +(entryPrice * (1 + tpPct)).toFixed(2)
    : +(entryPrice * (1 - tpPct)).toFixed(2);
  const slPrice = side === 'LONG'
    ? +(entryPrice * (1 - slPct)).toFixed(2)
    : +(entryPrice * (1 + slPct)).toFixed(2);

  // 4) 익절 주문 (limit, reduceOnly)
  const tpOrder = await exchange.createOrder(
    symbol,
    'limit',
    side === 'LONG' ? 'sell' : 'buy',
    qty,
    tpPrice,
    {
      positionSide: side,
      reduceOnly: true,
      timeInForce: 'GTC'
    }
  );

  // 5) 손절 주문 (stop_market, reduceOnly)
  const slOrder = await exchange.createOrder(
    symbol,
    'stop_market',
    side === 'LONG' ? 'sell' : 'buy',
    qty,
    undefined,
    {
      positionSide: side,
      stopPrice: slPrice,
      reduceOnly: true
    }
  );

  return { entryOrder, tpOrder, slOrder };
}
