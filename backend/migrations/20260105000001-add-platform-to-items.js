'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // items 테이블에 platform 컬럼 추가
    await queryInterface.addColumn('items', 'platform', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: '판매 플랫폼 (쿠팡, 네이버, 11번가 등)'
    });

    console.log('Added platform column to items table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('items', 'platform');
    console.log('Removed platform column from items table');
  }
};
