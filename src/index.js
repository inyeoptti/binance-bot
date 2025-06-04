// index.js
import 'dotenv/config';           // .env 파일 로드
import runBot from './bot.js';    // bot.js에서 bot 실행 로직을 default export

// 엔트리포인트: 봇 실행
runBot().catch(err => {
  console.error('Fatal error in trading bot:', err);
  process.exit(1);
});