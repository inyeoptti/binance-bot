/**
 * 거래량 상위 10개 페어의 과거 펀딩비를 일별 평균으로 계산하여 CSV로 저장하는 스크립트
 *
 * • node-binance-api v1.0.9 사용
 * • .env 파일에 BINANCE_API_KEY, BINANCE_API_SECRET 지정
 * • 기본 조회 기간: 최근 30일
 *
 * 사용법:
 *  1. npm install node-binance-api dotenv
 *  2. .env 파일에 아래 두 줄 추가
 *     BINANCE_API_KEY=your_api_key
 *     BINANCE_API_SECRET=your_api_secret
 *  3. node funding_rate_daily_avg.js
 */

console.log('스크립트 시작');

import dotenv from 'dotenv';
import axios from 'axios';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

console.log('dotenv 로드 전');
dotenv.config();
console.log('dotenv 로드 완료');

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 환경 변수에서 키 불러오기
const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
console.log('API_KEY:', API_KEY);
console.log('API_SECRET:', API_SECRET ? '(존재함)' : '(없음)');

if (!API_KEY || !API_SECRET) {
  console.error('ERROR: .env 파일에 BINANCE_API_KEY 및 BINANCE_API_SECRET을 설정하세요.');
  process.exit(1);
}

// 조회할 과거 기간 (일 단위)
const DAYS_TO_FETCH = 30;
// 타임스탬프 계산 (밀리초)
const endTime = Date.now();
const startTime = endTime - DAYS_TO_FETCH * 24 * 60 * 60 * 1000;

// CSV 파일 경로
const OUTPUT_CSV = join(__dirname, 'top10_funding_rate_daily_avg.csv');
console.log('OUTPUT_CSV 경로:', OUTPUT_CSV);

(async () => {
  try {
    console.log('1) 선물 24시간 통계 REST API 호출');
    // REST API 직접 호출로 대체
    const { data: futuresStats } = await axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr');
    console.log('futuresStats 개수:', Array.isArray(futuresStats) ? futuresStats.length : 'N/A');

    // quoteVolume을 기준으로 내림차순 정렬한 뒤 상위 10개 심볼 추출
    const top10 = futuresStats
      .filter((item) => item.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 10)
      .map((item) => item.symbol);

    console.log('거래량 상위 10개 심볼:', top10);

    // 결과를 담을 배열: { symbol, date, avgFundingRate }
    const csvRows = [];
    csvRows.push('symbol,date,avgFundingRate');

    // 2) 각 심볼마다 과거 펀딩비 조회 후 일별 평균 계산
    for (const symbol of top10) {
      console.log(`\n[${symbol}] 펀딩비 내역 조회 중…`);

      // API 호출: 펀딩비 내역
      const fundingUrl = 'https://fapi.binance.com/fapi/v1/fundingRate';
      const params = { symbol, startTime, endTime, limit: 1000 };
      const { data: fundingData } = await axios.get(fundingUrl, { params });
      console.log(`[${symbol}] fundingData 개수:`, Array.isArray(fundingData) ? fundingData.length : 'N/A');

      if (!Array.isArray(fundingData) || fundingData.length === 0) {
        console.warn(`⚠️ ${symbol}의 펀딩비 데이터가 없습니다.`);
        continue;
      }

      // 일별로 펀딩비 모아서 평균 계산
      const dailyMap = {};
      fundingData.forEach((entry) => {
        const time = parseInt(entry.fundingTime); // ms
        const rate = parseFloat(entry.fundingRate);
        // YYYY-MM-DD 형식의 문자열 생성 (UTC 기준)
        const dateStr = new Date(time).toISOString().slice(0, 10);
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = [];
        }
        dailyMap[dateStr].push(rate);
      });

      // 일별 평균 계산
      Object.entries(dailyMap).forEach(([date, rates]) => {
        const sum = rates.reduce((acc, v) => acc + v, 0);
        const avg = sum / rates.length;
        csvRows.push(`${symbol},${date},${avg.toFixed(8)}`);
      });

      console.log(`  ✅ ${symbol} 일별 평균 펀딩비 계산 완료 (${Object.keys(dailyMap).length}일)`);
    }

    // 3) CSV 파일로 저장
    console.log('CSV 파일 저장 시도, row 수:', csvRows.length);
    writeFileSync(OUTPUT_CSV, csvRows.join('\n'), { encoding: 'utf8' });
    console.log(`\nCSV 파일 저장 완료: ${OUTPUT_CSV}`);
  } catch (err) {
    console.error('에러 발생:', err);
  }
})();
