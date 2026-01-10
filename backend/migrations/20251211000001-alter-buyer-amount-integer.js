'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 기존 DECIMAL 데이터를 정수로 반올림하여 INTEGER로 변경
    await queryInterface.changeColumn('buyers', 'amount', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    // 롤백: INTEGER를 다시 DECIMAL(10,2)로 변경
    await queryInterface.changeColumn('buyers', 'amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });
  }
};
