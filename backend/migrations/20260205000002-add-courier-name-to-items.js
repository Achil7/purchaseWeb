'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('items');

    if (!tableInfo.courier_name) {
      await queryInterface.addColumn('items', 'courier_name', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '롯데택배'
      });
      console.log('courier_name column added to items table');
    } else {
      console.log('courier_name column already exists in items table, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('items');

    if (tableInfo.courier_name) {
      await queryInterface.removeColumn('items', 'courier_name');
      console.log('courier_name column removed from items table');
    }
  }
};
