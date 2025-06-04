// src/modules/logger.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { config } from '../config.js';

const {
  db: { file }
} = config;

let db;

/**
 * DB 연결 풀 초기화
 */
export async function initDb() {
  if (db) return;
  db = await open({
    filename: file,
    driver: sqlite3.Database
  });

  // 초기 테이블 생성 (이미 존재하면 무시)
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      entry_price REAL NOT NULL,
      entry_qty REAL NOT NULL,
      entry_leverage INTEGER NOT NULL,
      tp_pct REAL NOT NULL,
      sl_pct REAL NOT NULL,
      exit_price REAL,
      exit_reason TEXT,
      pnl REAL,
      duration_seconds INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await db.exec(createTableSQL);
}

/**
 * 진입 시 Trade 기록
 * @param {object} info
 * @param {Date} info.timestamp
 * @param {string} info.symbol
 * @param {'LONG'|'SHORT'} info.side
 * @param {number} info.entryPrice
 * @param {number} info.entryQty
 * @param {number} info.leverage
 * @param {number} info.tpPct
 * @param {number} info.slPct
 * @returns {Promise<number>} insert된 trade ID
 */
export async function logTradeOpen({ timestamp, symbol, side, entryPrice, entryQty, entryLeverage, tpPct, slPct }) {
  const sql = `
    INSERT INTO trades
      (timestamp, symbol, side, entry_price, entry_qty, entry_leverage, tp_pct, sl_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    timestamp,
    symbol,
    side,
    entryPrice,
    entryQty,
    entryLeverage,
    tpPct,
    slPct
  ];
  const result = await db.run(sql, params);
  return result.lastID;
}

/**
 * 청산 시 Trade 업데이트
 * @param {object} info
 * @param {number} info.tradeId
 * @param {number} info.exitPrice
 * @param {'TAKE_PROFIT'|'STOP_LOSS'|'EMERGENCY'|'MANUAL'} info.exitReason
 * @param {number} info.pnl
 * @param {number} info.durationSeconds
 */
export async function logTradeClose({ tradeId, exitPrice, exitReason, pnl, durationSeconds }) {
  const sql = `
    UPDATE trades
    SET exit_price = ?, exit_reason = ?, pnl = ?, duration_seconds = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [exitPrice, exitReason, pnl, durationSeconds, tradeId];
  await db.run(sql, params);
}
