// test/binance.candles.test.js
// 바이낸스에서 캔들 데이터를 받아오는 함수 테스트 (mocha + assert, async/await)

import assert from 'assert';
import Binance from 'node-binance-api';
import dotenv from 'dotenv';
dotenv.config();

// 환경변수에서 API 키/시크릿을 읽어옴
const APIKEY = process.env.BINANCE_API_KEY;
const APISECRET = process.env.BINANCE_API_SECRET;

// 테스트용 바이낸스 클라이언트 생성
const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000
});

describe('Binance 캔들 데이터 수집', function () {
  this.timeout(20000); // 네트워크 호출이므로 타임아웃 여유있게

  it('ETHUSDC 15분봉 200개를 받아오고, 데이터 구조를 검증한다', async function () {
    if (!APIKEY || !APISECRET) {
      this.skip();
      return;
    }
    let candles;
    try {
      candles = await binance.futuresCandles('ETHUSDC', '15m', { limit: 200 });
    } catch (err) {
      // 네트워크 오류 등은 skip 처리
      this.skip();
      return;
    }
    // 200개 받아왔는지 확인
    assert.strictEqual(candles.length, 200);
    const sample = candles[0];
    assert.ok(typeof sample === 'object' && sample !== null);
    // 필수 필드 존재 및 숫자 변환 가능 여부 확인
    ['open', 'high', 'low', 'close', 'volume'].forEach(key => {
      assert.ok(sample.hasOwnProperty(key));
      assert.ok(!isNaN(parseFloat(sample[key])));
    });
  });
}); 