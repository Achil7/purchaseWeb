'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 컬럼이 이미 존재하는지 확인
    const tableInfo = await queryInterface.describeTable('item_slots');

    if (!tableInfo.is_suspended) {
      await queryInterface.addColumn('item_slots', 'is_suspended', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });

      // 인덱스 추가
      try {
        await queryInterface.addIndex('item_slots', ['is_suspended'], {
          name: 'idx_item_slots_is_suspended'
        });
      } catch (e) {
        console.log('Index may already exist, continuing...');
      }
    } else {
      console.log('is_suspended column already exists, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('item_slots');

    if (tableInfo.is_suspended) {
      try {
        await queryInterface.removeIndex('item_slots', 'idx_item_slots_is_suspended');
      } catch (e) {
        console.log('Index may not exist, continuing...');
      }
      await queryInterface.removeColumn('item_slots', 'is_suspended');
    }
  }
};
