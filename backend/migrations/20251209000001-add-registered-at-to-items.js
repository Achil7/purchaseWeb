'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'registered_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    // 기존 데이터에 대해 created_at 값으로 registered_at 설정
    await queryInterface.sequelize.query(
      'UPDATE items SET registered_at = created_at WHERE registered_at IS NULL'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('items', 'registered_at');
  }
};
