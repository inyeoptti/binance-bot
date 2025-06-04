// src/modules/logger.js
import mysql from 'mysql2/promise';
import { config } from '../config.js';

const {
  db: { host, user, password, database }
} = config;

let pool;

/**
 * DB 연결 풀 초기화
 */
export async function initDb() {
  if (pool) return;
  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // 초기 테이블 생성 (이미 존재하면 무시)
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS trades (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      timestamp DATETIME NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      side ENUM('LONG','SHORT') NOT NULL,
      entry_price DECIMAL(18,8) NOT NULL,
      entry_qty DECIMAL(18,8) NOT NULL,
      entry_leverage INT NOT NULL,
      tp_pct DECIMAL(10,8) NOT NULL,
      sl_pct DECIMAL(10,8) NOT NULL,
      exit_price DECIMAL(18,8) NULL,
      exit_reason ENUM('TAKE_PROFIT','STOP_LOSS','EMERGENCY','MANUAL') NULL,
      pnl DECIMAL(18,8) NULL,
      duration_seconds INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;
  await pool.execute(createTableSQL);
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
export async function logTradeOpen({ timestamp, symbol, side, entryPrice, entryQty, leverage, tpPct, slPct }) {
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
    leverage,
    tpPct,
    slPct
  ];
  const [result] = await pool.execute(sql, params);
  return result.insertId;
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
    SET exit_price = ?, exit_reason = ?, pnl = ?, duration_seconds = ?
    WHERE id = ?
  `;
  const params = [exitPrice, exitReason, pnl, durationSeconds, tradeId];
  await pool.execute(sql, params);
}
