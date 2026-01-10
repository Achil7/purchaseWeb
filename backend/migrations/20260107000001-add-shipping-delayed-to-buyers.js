'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // buyers 테이블에 shipping_delayed 컬럼 추가 (배송지연 여부)
    await queryInterface.addColumn('buyers', 'shipping_delayed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    // 인덱스 추가 (배송지연 필터용)
    await queryInterface.addIndex('buyers', ['shipping_delayed'], {
      name: 'buyers_shipping_delayed_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('buyers', 'buyers_shipping_delayed_idx');
    await queryInterface.removeColumn('buyers', 'shipping_delayed');
  }
};
