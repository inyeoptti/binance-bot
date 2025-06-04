// src/bot.js
import moment from 'moment';
import dataFetcher from './modules/dataFetcher.js';
import { generateSignal } from './modules/signalGenerator.js';
import { calcLeverage } from './modules/leverageCalc.js';
import { openPosition } from './modules/orderManager.js';
import { logTradeOpen, logTradeClose, initDb } from './modules/logger.js';
import { notifyTradeOpen, notifyTradeClose, notifyEmergency, sendTelegramAlert } from './modules/notifier.js';
import { config } from './config.js';

const {
  trading: {
    symbol: SYMBOL,
    timeframe: INTERVAL,
    maxLeverage: MAX_LEVERAGE,
    useMarginRatio: USE_MARGIN_RATIO,
    atrPeriod: ATR_PERIOD,
    bbPeriod: BB_PERIOD,
    bbStdMultiplier: BB_STD_MULTIPLIER,
    maxDailyTrades: MAX_DAILY_TRADES,
    emaPeriod: EMA_PERIOD
  }
} = config;

// 전역 상태
let candles = [];
let dailyCount = 0;
let lastResetDay = moment.utc().format('YYYY-MM-DD');

// 매핑용 자료구조
const orderIdToTradeId = new Map();   // CCXT 주문 ID → DB tradeId
const tpOrderIds = new Set();         // TP 주문 ID 집합
const slOrderIds = new Set();         // SL 주문 ID 집합
const tradeOpenInfo = new Map();      // tradeId → { entryPrice, qty, side, timestamp }
const processedFillIds = new Set();   // 이미 처리된 fill ID

/**
 * UTC 기준 자정이 지나면 dailyCount를 리셋합니다.
 */
function checkDailyReset() {
  const todayUTC = moment.utc().format('YYYY-MM-DD');
  if (todayUTC !== lastResetDay) {
    dailyCount = 0;
    lastResetDay = todayUTC;
    console.log(`[${todayUTC}] Daily trade count reset.`);
  }
}

/**
 * 봇 실행 함수
 */
export default async function runBot() {
  // 1) DB 초기화
  await initDb();

  // 2) 초기 과거 데이터 로딩: 필요한 최대 ATR/BB/EMA 기간 + 여유분
  try {
    const limit = Math.max(
      Number(ATR_PERIOD) + 1,
      Number(BB_PERIOD) + 1,
      Number(EMA_PERIOD) + 1
    );
    candles = await dataFetcher.fetchHistorical(SYMBOL, INTERVAL, limit);
    console.log(`Loaded ${candles.length} historical candles for ${SYMBOL} ${INTERVAL}.`);
  } catch (err) {
    console.error('초기 과거 데이터 로딩 실패:', err);
    process.exit(1);
  }

  // 3) 주기적 루프: INTERVAL마다 실행
  while (true) {
    try {
      // 3.1) UTC 자정 리셋 확인
      checkDailyReset();

      // 3.2) 최신 봉 가져오기
      const latest = await dataFetcher.fetchLatestCandle(SYMBOL, INTERVAL);
      if (latest) {
        // 필요한 봉 개수 유지 (ATR_PERIOD, BB_PERIOD, EMA_PERIOD 등)
        const keep = Math.max(
          Number(ATR_PERIOD),
          Number(BB_PERIOD),
          Number(EMA_PERIOD)
        ) + 5;
        candles.push(latest);
        if (candles.length > keep) {
          candles = candles.slice(-keep);
        }
      } else {
        console.warn('최신 봉 가져오기 실패');
      }

      // 3.3) 시그널 생성
      const signalInfo = generateSignal(candles);
      if (signalInfo && dailyCount < Number(MAX_DAILY_TRADES)) {
        // 텔레그램 알림 전송
        const { TELEGRAM_WEBHOOK } = process.env;
        const alertMessage = `\uD83D\uDD14 *트레이딩 시그널 알림*\n\n종목: ${SYMBOL}\n방향: *${signalInfo.side}*\n진입가: ${signalInfo.entryPrice}\n익절(TP): ${signalInfo.tpPct}%\n손절(SL): ${signalInfo.slPct}%`;
        await sendTelegramAlert(TELEGRAM_WEBHOOK, alertMessage);
        const { side, entryPrice, tpPct, slPct } = signalInfo;

        // 3.4) 레버리지 계산
        const { leverage } = await calcLeverage(SYMBOL, INTERVAL);
        const intLeverage = Math.min(
          Math.ceil(leverage),
          Number(MAX_LEVERAGE)
        );

        // 3.5) 포지션 사이즈 계산 (잔고 × useMarginRatio ÷ 진입가)
        const balance = await dataFetcher.fetchAccountBalance(); // USDC 잔고
        const useAmount = balance * Number(USE_MARGIN_RATIO);
        const qty = useAmount / entryPrice;

        // 3.6) 주문 실행: 시장가 진입 및 TP/SL 브래킷 주문
        const { entryOrder, tpOrder, slOrder } = await openPosition({
          symbol: SYMBOL,
          side,
          qty,
          entryPrice,
          leverage: intLeverage,
          tpPct,
          slPct
        });

        // 3.7) DB에 진입 기록 및 알림
        const tradeId = await logTradeOpen({
          timestamp: new Date(),
          symbol: SYMBOL,
          side,
          entryPrice,
          entryQty: qty,
          entryLeverage: intLeverage,
          tpPct,
          slPct
        });
        await notifyTradeOpen({
          symbol: SYMBOL,
          side,
          entryPrice,
          qty,
          leverage: intLeverage,
          tpPct,
          slPct
        });

        // 3.8) 매핑 정보 저장
        orderIdToTradeId.set(entryOrder.id, tradeId);
        orderIdToTradeId.set(tpOrder.id, tradeId);
        orderIdToTradeId.set(slOrder.id, tradeId);
        tpOrderIds.add(tpOrder.id);
        slOrderIds.add(slOrder.id);
        tradeOpenInfo.set(tradeId, {
          entryPrice,
          qty,
          side,
          timestamp: Date.now()
        });

        // 3.9) dailyCount 증가
        dailyCount += 1;
      }

      // 3.10) 체결 확인 및 청산 처리
      const fills = await dataFetcher.fetchRecentFills(SYMBOL);
      for (const fill of fills) {
        // 이미 처리된 체결이면 패스
        if (processedFillIds.has(fill.id)) continue;

        // 이 체결이 청산 주문에 해당하는지 확인
        const parentOrderId = fill.orderId; // CCXT fill 객체의 주문 ID 필드
        const tradeId = orderIdToTradeId.get(parentOrderId);
        if (!tradeId) {
          // 매핑되지 않은 주문은 무시
          processedFillIds.add(fill.id);
          continue;
        }

        // exitPrice
        const exitPrice = fill.price;

        // exitReason 판단
        let exitReason = 'MANUAL';
        if (tpOrderIds.has(parentOrderId)) {
          exitReason = 'TAKE_PROFIT';
        } else if (slOrderIds.has(parentOrderId)) {
          exitReason = 'STOP_LOSS';
        } else {
          exitReason = 'EMERGENCY';
        }

        // entry 정보 조회
        const openInfo = tradeOpenInfo.get(tradeId);
        const { entryPrice, qty, side, timestamp: entryTs } = openInfo;

        // pnl 계산
        let pnl;
        if (side === 'LONG') {
          pnl = (+exitPrice - +entryPrice) * +qty;
        } else {
          pnl = (+entryPrice - +exitPrice) * +qty;
        }

        // durationSeconds 계산
        const durationSeconds = Math.floor((fill.timestamp - entryTs) / 1000);

        // DB 업데이트
        await logTradeClose({
          tradeId,
          exitPrice,
          exitReason,
          pnl,
          durationSeconds
        });

        // Discord 알림
        await notifyTradeClose({
          symbol: SYMBOL,
          side,
          exitPrice,
          exitReason,
          pnl
        });

        // 매핑 정리
        orderIdToTradeId.delete(parentOrderId);
        tpOrderIds.delete(parentOrderId);
        slOrderIds.delete(parentOrderId);
        tradeOpenInfo.delete(tradeId);
        processedFillIds.add(fill.id);
      }

    } catch (err) {
      console.error('루프 내 오류:', err);
      await notifyEmergency({ message: err.message });
    }

    // INTERVAL 간격(밀리초) 동안 대기
    const waitMs = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000
    }[INTERVAL] || 15 * 60 * 1000;

    await new Promise(r => setTimeout(r, waitMs));
  }
}
