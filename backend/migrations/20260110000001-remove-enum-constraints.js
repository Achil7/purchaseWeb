'use strict';

/**
 * ENUM 제약 제거 - 자유 입력으로 변경
 * - items.shipping_type: ENUM('실출고', '미출고') → VARCHAR(50)
 * - items.status: ENUM('active', 'completed', 'cancelled') → VARCHAR(50)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // shipping_type ENUM → VARCHAR 변경
    await queryInterface.changeColumn('items', 'shipping_type', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // status ENUM → VARCHAR 변경
    await queryInterface.changeColumn('items', 'status', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'active'
    });

    // ENUM 타입 삭제 (PostgreSQL)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_items_shipping_type" CASCADE;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_items_status" CASCADE;');
  },

  async down(queryInterface, Sequelize) {
    // Rollback: VARCHAR → ENUM 복원
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_items_shipping_type" AS ENUM('실출고', '미출고');
    `);
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_items_status" AS ENUM('active', 'completed', 'cancelled');
    `);

    await queryInterface.changeColumn('items', 'shipping_type', {
      type: Sequelize.ENUM('실출고', '미출고'),
      allowNull: true
    });

    await queryInterface.changeColumn('items', 'status', {
      type: Sequelize.ENUM('active', 'completed', 'cancelled'),
      allowNull: true,
      defaultValue: 'active'
    });
  }
};
