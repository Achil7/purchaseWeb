'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('buyers', 'courier_company', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: '택배사'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('buyers', 'courier_company');
  }
};
