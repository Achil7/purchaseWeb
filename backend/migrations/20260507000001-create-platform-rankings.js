'use strict';

/**
 * platform_rankings 테이블 생성
 *
 * 올리브영 카테고리 BEST 100 순위 시계열 저장
 * - 사용자 PC 로컬 워커가 직접 INSERT (EC2 백엔드는 SELECT만)
 * - 21개 카테고리 × 100위 × N라운드
 * - collected_at 기준으로 라운드 구분 (같은 라운드 = 같은 collected_at 근처)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 이전 마이그레이션 시도가 부분적으로 남아있을 수 있어 깨끗하게 정리 후 재생성
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_pr_category_collected;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_pr_goods_no;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_pr_collected_at;');
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS platform_rankings CASCADE;');

    await queryInterface.sequelize.query(`
      CREATE TABLE platform_rankings (
        id SERIAL PRIMARY KEY,
        category_id VARCHAR(50) NOT NULL,
        category_name VARCHAR(100) NOT NULL,
        rank INTEGER NOT NULL,
        product_name TEXT,
        brand_name VARCHAR(255),
        goods_no VARCHAR(100),
        product_url TEXT,
        image_url TEXT,
        price VARCHAR(255),
        collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryInterface.sequelize.query(
      'CREATE INDEX idx_pr_category_collected ON platform_rankings(category_id, collected_at);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX idx_pr_goods_no ON platform_rankings(goods_no);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX idx_pr_collected_at ON platform_rankings(collected_at);'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('platform_rankings');
  }
};
