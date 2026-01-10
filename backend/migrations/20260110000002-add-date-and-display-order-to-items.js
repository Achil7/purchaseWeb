'use strict';

/**
 * Item 테이블에 date, display_order 필드 추가
 * - date: 제품의 날짜 (사용자 입력)
 * - display_order: 제품의 표시 순번 (1, 2, 3...)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'date', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: '제품 날짜 (사용자 입력)'
    });

    await queryInterface.addColumn('items', 'display_order', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: '제품 표시 순번 (1, 2, 3...)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('items', 'date');
    await queryInterface.removeColumn('items', 'display_order');
  }
};
