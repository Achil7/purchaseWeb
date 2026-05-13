const app = require('./src/app');
const { sequelize } = require('./src/models');
const { startTrashCleanupScheduler } = require('./src/schedulers/trashCleanup');
const rankingScheduler = require('./src/schedulers/rankingScheduler');
const { startEnvWatcher } = require('./src/services/rankingTracker/proxyConfig');

const PORT = process.env.PORT || 5000;

// 데이터베이스 연결 테스트
sequelize
  .authenticate()
  .then(() => {
    console.log('✅ Database connection established successfully');

    // 새 테이블 자동 생성 (기존 테이블은 변경하지 않음)
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    console.log('✅ Database models synchronized');

    // 서버 시작
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);

      // 휴지통 자동 정리 스케줄러 시작
      startTrashCleanupScheduler();

      // .env 파일 PROXY_* 변수 자동 감지 (재시작 없이 ON/OFF 전환 반영)
      startEnvWatcher();

      // 올리브영 랭킹 자동 수집 스케줄러 시작 (.env: RANKING_AUTO_ENABLED=true)
      rankingScheduler.start();
    });
  })
  .catch((err) => {
    console.error('❌ Unable to connect to the database:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    sequelize.close();
  });
});
