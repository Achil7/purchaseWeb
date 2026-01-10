'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // shipping_deadline 컬럼 타입을 DATE에서 STRING으로 변경
    await queryInterface.changeColumn('items', 'shipping_deadline', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // 롤백: STRING에서 DATE로 복원
    await queryInterface.changeColumn('items', 'shipping_deadline', {
      type: Sequelize.DATE,
      allowNull: true
    });
  }
};
