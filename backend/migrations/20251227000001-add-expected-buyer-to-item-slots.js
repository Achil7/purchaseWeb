'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('item_slots', 'expected_buyer', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: '예상구매자 (진행자 입력)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('item_slots', 'expected_buyer');
  }
};
