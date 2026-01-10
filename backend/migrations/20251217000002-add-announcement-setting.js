'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 공지사항 설정 추가
    await queryInterface.bulkInsert('settings', [
      { key: 'login_announcement', value: null, updated_at: new Date() }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('settings', { key: 'login_announcement' });
  }
};
