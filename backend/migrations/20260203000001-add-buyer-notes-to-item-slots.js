'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('item_slots', 'buyer_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: '구매자 테이블의 비고 컬럼 (제품 테이블의 notes와 별개)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('item_slots', 'buyer_notes');
  }
};
