'use strict';

/**
 * platform_rankings 테이블에 가격 분리 컬럼 추가
 *
 * - original_price: 취소선 원가 (할인 전 가격)
 * - sale_price: 실제 판매가
 * - discount_rate: 할인율(%) (할인 없으면 null)
 *
 * 기존 price 컬럼은 호환성을 위해 유지 (raw 텍스트)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE platform_rankings
        ADD COLUMN IF NOT EXISTS original_price VARCHAR(50),
        ADD COLUMN IF NOT EXISTS sale_price VARCHAR(50),
        ADD COLUMN IF NOT EXISTS discount_rate INTEGER;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE platform_rankings
        DROP COLUMN IF EXISTS original_price,
        DROP COLUMN IF EXISTS sale_price,
        DROP COLUMN IF EXISTS discount_rate;
    `);
  }
};
