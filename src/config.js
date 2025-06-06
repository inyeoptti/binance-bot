import dotenv from 'dotenv';
dotenv.config();

const {
  BINANCE_API_KEY,
  BINANCE_API_SECRET,
  BINANCE_API_URL,
  DB_FILE,
  DISCORD_WEBHOOK_URL,
  SYMBOL,
  TIMEFRAME,
  MAX_LEVERAGE,
  USE_MARGIN_RATIO,
  ATR_PERIOD,
  BB_PERIOD,
  BB_STD_MULTIPLIER,
  MAX_DAILY_TRADES,
  DRY_RUN,
} = process.env;

export const config = {
  binance: {
    apiKey: BINANCE_API_KEY,
    apiSecret: BINANCE_API_SECRET,
    apiUrl: BINANCE_API_URL,
  },
  db: {
    file: DB_FILE,
  },
  discord: {
    webhookUrl: DISCORD_WEBHOOK_URL,
  },
  trading: {
    symbol: SYMBOL,
    timeframe: TIMEFRAME,
    maxLeverage: MAX_LEVERAGE,
    useMarginRatio: USE_MARGIN_RATIO,
    atrPeriod: ATR_PERIOD,
    bbPeriod: BB_PERIOD,
    bbStdMultiplier: BB_STD_MULTIPLIER,
    maxDailyTrades: MAX_DAILY_TRADES,
    emaPeriod: process.env.EMA_PERIOD,
    tpPct: process.env.TP_PCT,
    slPct: process.env.SL_PCT,
  },
  dryRun: DRY_RUN === 'true',
};
