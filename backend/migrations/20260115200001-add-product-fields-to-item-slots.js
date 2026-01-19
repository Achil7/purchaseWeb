'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 일마감 시 day_group별 독립적인 제품 정보를 위해 ItemSlot에 필드 추가
    const columnsToAdd = [
      { name: 'platform', type: Sequelize.TEXT },
      { name: 'shipping_type', type: Sequelize.TEXT },
      { name: 'total_purchase_count', type: Sequelize.TEXT },
      { name: 'daily_purchase_count', type: Sequelize.TEXT },
      { name: 'courier_service_yn', type: Sequelize.TEXT },
      { name: 'product_url', type: Sequelize.TEXT }
    ];

    for (const col of columnsToAdd) {
      try {
        await queryInterface.addColumn('item_slots', col.name, {
          type: col.type,
          allowNull: true
        });
        console.log(`Added column ${col.name} to item_slots`);
      } catch (error) {
        console.log(`Column ${col.name} may already exist: ${error.message}`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const columnsToRemove = [
      'platform',
      'shipping_type',
      'total_purchase_count',
      'daily_purchase_count',
      'courier_service_yn',
      'product_url'
    ];

    for (const col of columnsToRemove) {
      try {
        await queryInterface.removeColumn('item_slots', col);
      } catch (error) {
        console.log(`Column ${col} may not exist: ${error.message}`);
      }
    }
  }
};
