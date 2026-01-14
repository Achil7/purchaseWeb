'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('items', 'product_name', { type: Sequelize.TEXT, allowNull: false });
    await queryInterface.changeColumn('items', 'shipping_type', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('items', 'keyword', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('items', 'purchase_option', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('items', 'product_price', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('items', 'shipping_deadline', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('items', 'platform', { type: Sequelize.TEXT, allowNull: true });
    // courier_service_yn: BOOLEAN -> TEXT 변환 (USING 절 필요)
    await queryInterface.sequelize.query(`
      ALTER TABLE items
      ALTER COLUMN courier_service_yn TYPE TEXT
      USING CASE WHEN courier_service_yn = true THEN 'Y' WHEN courier_service_yn = false THEN 'N' ELSE NULL END
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('items', 'product_name', { type: Sequelize.STRING(200), allowNull: false });
    await queryInterface.changeColumn('items', 'shipping_type', { type: Sequelize.STRING(50), allowNull: true });
    await queryInterface.changeColumn('items', 'keyword', { type: Sequelize.STRING(200), allowNull: true });
    await queryInterface.changeColumn('items', 'purchase_option', { type: Sequelize.STRING(100), allowNull: true });
    await queryInterface.changeColumn('items', 'product_price', { type: Sequelize.DECIMAL(10, 2), allowNull: true });
    await queryInterface.changeColumn('items', 'shipping_deadline', { type: Sequelize.STRING(20), allowNull: true });
    await queryInterface.changeColumn('items', 'platform', { type: Sequelize.STRING(50), allowNull: true });
    await queryInterface.changeColumn('items', 'courier_service_yn', { type: Sequelize.BOOLEAN, defaultValue: false });
  }
};
