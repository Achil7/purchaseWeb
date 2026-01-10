'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // PostgreSQL에서 ENUM에 새 값 추가
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_campaigns_status ADD VALUE IF NOT EXISTS 'new';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_campaigns_status ADD VALUE IF NOT EXISTS 'hold';
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL에서 ENUM 값 제거는 복잡하므로 down은 비워둠
    // 실제로 ENUM 값을 제거하려면 테이블을 재생성해야 함
  }
};
