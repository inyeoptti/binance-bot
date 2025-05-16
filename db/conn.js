// db/conn.js
// SQLite3 단일 연결 모듈 (ESM)
// - DB 파일이 없으면 자동 생성
// - 테이블 구조 변경 시 자동 alter table 지원
// - 연결 실패/권한 문제 발생 시 오류 출력 후 종료
// - AI가 이해하기 쉽도록 상세 주석 포함

import fs from 'fs';
import path from 'path';
import sqlite3pkg from 'sqlite3';
const sqlite3 = sqlite3pkg.verbose();

// ESM 환경에서 현재 파일의 디렉토리 구하기
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'app.db');

// 테이블 정의 (개발 진행에 따라 변경될 수 있음)
const TABLE_DEFS = [
  {
    name: 'candles',
    columns: [
      'id INTEGER PRIMARY KEY AUTOINCREMENT',
      'timestamp TEXT NOT NULL',
      'timeframe TEXT NOT NULL',
      'open REAL NOT NULL',
      'high REAL NOT NULL',
      'low REAL NOT NULL',
      'close REAL NOT NULL',
      'volume REAL NOT NULL',
      'ha_open REAL',
      'ha_high REAL',
      'ha_low REAL',
      'ha_close REAL',
      'ema200 REAL',
      'stoch_rsi_k REAL',
      'stoch_rsi_d REAL'
    ]
  },
  {
    name: 'signals',
    columns: [
      'id INTEGER PRIMARY KEY AUTOINCREMENT',
      'timestamp TEXT NOT NULL',
      'timeframe TEXT NOT NULL',
      'local_signal TEXT NOT NULL',
      'ai_signal TEXT',
      'ai_confidence REAL',
      'final_signal TEXT NOT NULL'
    ]
  },
  {
    name: 'orders',
    columns: [
      'id INTEGER PRIMARY KEY AUTOINCREMENT',
      'order_id TEXT NOT NULL',
      'timestamp TEXT NOT NULL',
      'symbol TEXT NOT NULL',
      'side TEXT NOT NULL',
      'type TEXT NOT NULL',
      'price REAL',
      'quantity REAL NOT NULL',
      'status TEXT NOT NULL'
    ]
  },
  {
    name: 'positions',
    columns: [
      'id INTEGER PRIMARY KEY AUTOINCREMENT',
      'timestamp_open TEXT NOT NULL',
      'timestamp_close TEXT',
      'symbol TEXT NOT NULL',
      'side TEXT NOT NULL',
      'entry_price REAL NOT NULL',
      'exit_price REAL',
      'quantity REAL NOT NULL',
      'leverage INTEGER NOT NULL',
      'stop_loss REAL NOT NULL',
      'take_profit REAL NOT NULL',
      'pnl REAL',
      'status TEXT NOT NULL'
    ]
  },
  {
    name: 'logs',
    columns: [
      'id INTEGER PRIMARY KEY AUTOINCREMENT',
      'timestamp TEXT NOT NULL',
      'level TEXT NOT NULL',
      'message TEXT NOT NULL',
      'details TEXT'
    ]
  }
];

// DB 연결 객체 (단일 연결)
let db = null;

/**
 * DB 연결 및 초기화 함수
 * - DB 파일이 없으면 자동 생성
 * - 테이블 구조 변경 시 alter table로 자동 반영
 * - 연결 실패/권한 문제 발생 시 오류 출력 후 종료
 */
function connectAndInitDB() {
  try {
    // DB 파일이 없으면 자동 생성
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('[DB 연결 오류]', err.message);
        process.exit(1);
      }
    });
  } catch (e) {
    console.error('[DB 파일 생성/권한 오류]', e.message);
    process.exit(1);
  }
}

/**
 * 테이블 생성 및 변경사항 반영 함수
 * - 테이블이 없으면 생성
 * - 컬럼이 추가/변경되었으면 alter table로 반영
 * - 컬럼 삭제는 지원하지 않음(데이터 보존 목적)
 */
function syncTables() {
  db.serialize(() => {
    TABLE_DEFS.forEach(table => {
      // 1. 테이블이 없으면 생성
      const createSQL = `CREATE TABLE IF NOT EXISTS ${table.name} (${table.columns.join(', ')});`;
      db.run(createSQL, (err) => {
        if (err) {
          console.error(`[${table.name} 테이블 생성 오류]`, err.message);
          process.exit(1);
        }
      });
      // 2. 컬럼 변경사항 확인 및 alter table 적용
      db.all(`PRAGMA table_info(${table.name});`, (err, rows) => {
        if (err) {
          console.error(`[${table.name} 테이블 정보 조회 오류]`, err.message);
          process.exit(1);
        }
        const existingCols = rows.map(r => r.name);
        table.columns.forEach(colDef => {
          const colName = colDef.split(' ')[0];
          if (!existingCols.includes(colName)) {
            // 새 컬럼 추가
            const alterSQL = `ALTER TABLE ${table.name} ADD COLUMN ${colDef};`;
            db.run(alterSQL, (err) => {
              if (err) {
                console.error(`[${table.name} 테이블 컬럼 추가 오류]`, err.message);
                process.exit(1);
              }
            });
          }
        });
      });
    });
  });
}

// 모듈 초기화
connectAndInitDB();
syncTables();

// 외부에 DB 객체 export
export default db;

/**
 * 사용 예시 (ESM):
 * import db from './db/conn.js';
 * db.all('SELECT * FROM candles', (err, rows) => { ... });
 */ 