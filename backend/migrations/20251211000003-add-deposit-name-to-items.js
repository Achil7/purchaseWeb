'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'deposit_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: '입금명 (카톡방명)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('items', 'deposit_name');
  }
};
