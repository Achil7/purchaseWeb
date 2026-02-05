'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // items 테이블의 courier_name 기본값 제거
    await queryInterface.changeColumn('items', 'courier_name', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
    console.log('Removed default value from items.courier_name');

    // item_slots 테이블의 courier_name 기본값 제거
    await queryInterface.changeColumn('item_slots', 'courier_name', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
    console.log('Removed default value from item_slots.courier_name');
  },

  async down(queryInterface, Sequelize) {
    // 롤백 시 기본값 복원
    await queryInterface.changeColumn('items', 'courier_name', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: '롯데택배'
    });

    await queryInterface.changeColumn('item_slots', 'courier_name', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: '롯데택배'
    });
    console.log('Restored default values for courier_name columns');
  }
};
