'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('buyers', 'tracking_number', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    // 인덱스 추가 (검색 최적화)
    await queryInterface.addIndex('buyers', ['tracking_number'], {
      name: 'idx_buyers_tracking_number'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('buyers', 'idx_buyers_tracking_number');
    await queryInterface.removeColumn('buyers', 'tracking_number');
  }
};
