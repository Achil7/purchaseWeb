'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // pg_trgm extension 활성화 (ILIKE %pattern% 인덱스 활용 위해 필수)
    // 이미 활성화되어 있으면 IF NOT EXISTS로 안전
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // buyers.account_info GIN trgm 인덱스
    // buyerAnalytics.getAccounts의 ILIKE %accountKeyword% 검색에 활용
    // 풀스캔 → 인덱스 활용으로 검색 빨라짐
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_buyers_account_info_trgm
      ON buyers
      USING GIN (account_info gin_trgm_ops)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_buyers_account_info_trgm`);
    // pg_trgm extension은 다른 곳에서 쓸 수 있으므로 down에서 제거하지 않음
  }
};
