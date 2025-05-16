// src/db/candle.js
// 캔들 데이터 저장/조회 DAO (ESM)
// - candles 테이블에 insert, get, getByTimeframe, getLatest, upsert 함수 제공
// - 한글 주석 포함

import db from '../../db/conn.js';

/**
 * 캔들 데이터 저장 (insert)
 */
export function insertCandle(candle) {
  const sql = `INSERT INTO candles (
    timestamp, timeframe, open, high, low, close, volume,
    ha_open, ha_high, ha_low, ha_close, ema200, stoch_rsi_k, stoch_rsi_d
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    candle.timestamp, candle.timeframe, candle.open, candle.high, candle.low, candle.close, candle.volume,
    candle.ha_open, candle.ha_high, candle.ha_low, candle.ha_close, candle.ema200, candle.stoch_rsi_k, candle.stoch_rsi_d
  ];
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

/**
 * 특정 timeframe의 모든 캔들 조회
 */
export function getCandlesByTimeframe(timeframe, limit = 1000) {
  const sql = `SELECT * FROM candles WHERE timeframe = ? ORDER BY timestamp DESC LIMIT ?`;
  return new Promise((resolve, reject) => {
    db.all(sql, [timeframe, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * 가장 최근 캔들 조회
 */
export function getLatestCandle(timeframe) {
  const sql = `SELECT * FROM candles WHERE timeframe = ? ORDER BY timestamp DESC LIMIT 1`;
  return new Promise((resolve, reject) => {
    db.get(sql, [timeframe], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * 중복 방지용 upsert (있으면 update, 없으면 insert)
 */
export function upsertCandle(candle) {
  const checkSql = `SELECT id FROM candles WHERE timestamp = ? AND timeframe = ?`;
  return new Promise((resolve, reject) => {
    db.get(checkSql, [candle.timestamp, candle.timeframe], (err, row) => {
      if (err) return reject(err);
      if (row) {
        // update
        const updateSql = `UPDATE candles SET open=?, high=?, low=?, close=?, volume=?, ha_open=?, ha_high=?, ha_low=?, ha_close=?, ema200=?, stoch_rsi_k=?, stoch_rsi_d=? WHERE id=?`;
        const params = [
          candle.open, candle.high, candle.low, candle.close, candle.volume,
          candle.ha_open, candle.ha_high, candle.ha_low, candle.ha_close,
          candle.ema200, candle.stoch_rsi_k, candle.stoch_rsi_d, row.id
        ];
        db.run(updateSql, params, function(err) {
          if (err) return reject(err);
          resolve(row.id);
        });
      } else {
        // insert
        insertCandle(candle).then(resolve).catch(reject);
      }
    });
  });
} 