'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'assigned_sales_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: '담당 영업사 ID (브랜드 사용자 전용)'
    });

    await queryInterface.addIndex('users', ['assigned_sales_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', ['assigned_sales_id']);
    await queryInterface.removeColumn('users', 'assigned_sales_id');
  }
};
