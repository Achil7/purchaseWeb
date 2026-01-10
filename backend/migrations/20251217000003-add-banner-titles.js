'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 배너 영역 타이틀/서브타이틀 설정 추가
    await queryInterface.bulkInsert('settings', [
      { key: 'banner_title', value: 'CampManager', updated_at: new Date() },
      { key: 'banner_subtitle', value: '캠페인 관리 시스템', updated_at: new Date() }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('settings', {
      key: ['banner_title', 'banner_subtitle']
    });
  }
};
