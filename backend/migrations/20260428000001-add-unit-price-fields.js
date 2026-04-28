'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'unit_price', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: '단가 (영업사 입력)'
    });

    await queryInterface.addColumn('item_slots', 'unit_price', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: '단가 (day_group별 독립)'
    });

    await queryInterface.addColumn('buyers', 'unit_price', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: '단가 (구매자별 - 기본값은 품목 단가)'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('buyers', 'unit_price');
    await queryInterface.removeColumn('item_slots', 'unit_price');
    await queryInterface.removeColumn('items', 'unit_price');
  }
};
