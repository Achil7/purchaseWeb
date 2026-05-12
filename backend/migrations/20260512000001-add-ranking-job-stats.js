'use strict';

/**
 * ranking_collection_jobs 에 통계 컬럼 추가
 * - retry_attempts : 재시도 라운드 수 (0 = 1차에 모두 성공, 1 = 2차 시도, 2 = 3차 시도)
 * - total_attempts : 시도한 카테고리 누적 횟수 (재시도 포함)
 * - duration_ms    : 라운드 소요 시간 (밀리초)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ranking_collection_jobs
        ADD COLUMN IF NOT EXISTS retry_attempts INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_attempts INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ranking_collection_jobs
        DROP COLUMN IF EXISTS retry_attempts,
        DROP COLUMN IF EXISTS total_attempts,
        DROP COLUMN IF EXISTS duration_ms;
    `);
  }
};
