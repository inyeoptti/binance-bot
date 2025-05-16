// db/conn.test.js
// db/conn.js 연결 모듈 테스트 코드 (mocha + assert 기반)
// - 연결 성공/쿼리/에러 상황 테스트
// - mocha 기반, 테스트용 DB 파일 사용
// - 테스트 후 파일 삭제

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import assert from 'assert';

// ESM 환경에서 __dirname 구현
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// 테스트용 환경변수 설정 (테스트 DB 파일 경로)
process.env.DB_PATH = path.join(__dirname, 'test_app.db');

// 테스트 대상 모듈 import
import db from '../db/conn.js';

describe('db/conn.js SQLite 연결 모듈', function () {
  after(function (done) {
    // 테스트 후 DB 파일 삭제 (존재할 때만)
    db.close(() => {
      if (fs.existsSync(process.env.DB_PATH)) {
        fs.unlinkSync(process.env.DB_PATH);
      }
      done();
    });
  });

  it('DB 연결이 정상적으로 이루어진다', function (done) {
    // 연결 객체가 정의되어 있고, all 메서드가 존재해야 함
    assert.ok(db);
    assert.strictEqual(typeof db.all, 'function');
    done();
  });

  it('기본 쿼리 실행이 가능하다', function (done) {
    db.all('SELECT name FROM sqlite_master WHERE type="table";', (err, rows) => {
      assert.strictEqual(err, null);
      // candles, signals, orders, positions, logs 테이블이 모두 생성되어야 함
      const tableNames = rows.map(r => r.name);
      ['candles', 'signals', 'orders', 'positions', 'logs'].forEach(name => {
        assert.ok(tableNames.includes(name));
      });
      done();
    });
  });

  it('권한 문제 등으로 연결 실패 시 오류가 발생한다', function (done) {
    // 읽기 전용 디렉토리에 DB 파일을 생성 시도 (권한 오류 유도)
    const badPath = '/root/forbidden.db';
    const badDb = new sqlite3.Database(badPath, (err) => {
      assert.ok(err);
      done();
    });
  });
}); 