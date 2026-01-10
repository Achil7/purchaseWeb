'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // PostgreSQL에서 ENUM에 새 값 추가
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'item_created';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'operator_assigned';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'item_completed';
    `);
  },

  async down(queryInterface, Sequelize) {
    // ENUM 값 제거는 복잡하므로 down은 구현하지 않음
    // PostgreSQL에서는 ENUM 값 제거가 쉽지 않음
  }
};
