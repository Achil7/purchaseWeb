'use strict';

/**
 * ranking_collection_jobs : 수집 실행 로그 (rate limit + 진행상태 추적용)
 *
 *  - 자동 스케줄러, Admin 버튼, Brand 버튼 모든 호출 기록
 *  - status: 'pending' | 'running' | 'completed' | 'failed'
 *  - triggered_by: 'scheduler' | 'admin' | 'brand'
 *  - triggered_user_id: admin/brand 호출 시 user.id (rate limit 카운트용)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS ranking_collection_jobs (
        id SERIAL PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        triggered_by VARCHAR(20) NOT NULL,
        triggered_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        total_categories INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        inserted_rows INTEGER DEFAULT 0,
        current_idx INTEGER DEFAULT 0,
        current_category VARCHAR(100),
        error_text TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_rcj_status ON ranking_collection_jobs(status);`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_rcj_user_created ON ranking_collection_jobs(triggered_user_id, created_at);`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_rcj_created ON ranking_collection_jobs(created_at DESC);`
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ranking_collection_jobs');
  }
};
