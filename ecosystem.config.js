module.exports = {
  apps: [
    {
      name: "tradingBot",
      script: "index.js",
      cwd: "/home/yeop/src/binance",
      env: {
        NODE_ENV: "production",
        // dotenv에서 읽기 때문에 실제 .env 파일에 값 설정
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: "200M",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      combine_logs: true,
      time: true
    }
  ]
};
  