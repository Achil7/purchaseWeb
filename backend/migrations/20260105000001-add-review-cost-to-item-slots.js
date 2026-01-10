'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('item_slots', 'review_cost', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '리뷰비용 (진행자가 입력)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('item_slots', 'review_cost');
  }
};
