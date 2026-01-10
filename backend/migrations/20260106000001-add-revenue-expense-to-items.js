'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 판매 단가 (1개당 판매 가격)
    await queryInterface.addColumn('items', 'sale_price_per_unit', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '판매 단가 (원/개)'
    });

    // 택배대행 단가 (1개당)
    await queryInterface.addColumn('items', 'courier_price_per_unit', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '택배대행 단가 (원/개)'
    });

    // 지출: 제품비
    await queryInterface.addColumn('items', 'expense_product', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '지출 - 제품비 (원)'
    });

    // 지출: 택배비
    await queryInterface.addColumn('items', 'expense_courier', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '지출 - 택배비 (원)'
    });

    // 지출: 리뷰비용
    await queryInterface.addColumn('items', 'expense_review', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '지출 - 리뷰비용 (원)'
    });

    // 지출: 기타비용
    await queryInterface.addColumn('items', 'expense_other', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '지출 - 기타비용 (원)'
    });

    // 지출 메모
    await queryInterface.addColumn('items', 'expense_note', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: '지출 메모'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('items', 'sale_price_per_unit');
    await queryInterface.removeColumn('items', 'courier_price_per_unit');
    await queryInterface.removeColumn('items', 'expense_product');
    await queryInterface.removeColumn('items', 'expense_courier');
    await queryInterface.removeColumn('items', 'expense_review');
    await queryInterface.removeColumn('items', 'expense_other');
    await queryInterface.removeColumn('items', 'expense_note');
  }
};
