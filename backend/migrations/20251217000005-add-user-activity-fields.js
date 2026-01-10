'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 컬럼이 이미 존재하는지 확인 후 추가
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.initial_password) {
      await queryInterface.addColumn('users', 'initial_password', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: '초기 비밀번호 (Admin 확인용)'
      });
    } else {
      console.log('initial_password column already exists, skipping');
    }

    if (!tableInfo.last_activity) {
      await queryInterface.addColumn('users', 'last_activity', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '마지막 활동 시간 (Heartbeat 기준)'
      });
    } else {
      console.log('last_activity column already exists, skipping');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');

    if (tableInfo.initial_password) {
      await queryInterface.removeColumn('users', 'initial_password');
    }
    if (tableInfo.last_activity) {
      await queryInterface.removeColumn('users', 'last_activity');
    }
  }
};
