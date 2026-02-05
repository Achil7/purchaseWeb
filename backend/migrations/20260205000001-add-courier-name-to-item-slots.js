'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 컬럼이 이미 존재하는지 확인
    const tableInfo = await queryInterface.describeTable('item_slots');

    if (!tableInfo.courier_name) {
      await queryInterface.addColumn('item_slots', 'courier_name', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '롯데택배'
      });
      console.log('courier_name column added successfully');
    } else {
      console.log('courier_name column already exists, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('item_slots');

    if (tableInfo.courier_name) {
      await queryInterface.removeColumn('item_slots', 'courier_name');
      console.log('courier_name column removed successfully');
    }
  }
};
