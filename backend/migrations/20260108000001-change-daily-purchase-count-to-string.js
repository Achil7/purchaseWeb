'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // daily_purchase_count를 INTEGER에서 TEXT로 변경
    // 기존 INTEGER 값을 TEXT로 변환 (길이 제한 없음)
    await queryInterface.changeColumn('items', 'daily_purchase_count', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // 롤백 시 다시 INTEGER로 변경 (데이터 손실 가능)
    await queryInterface.changeColumn('items', 'daily_purchase_count', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  }
};
