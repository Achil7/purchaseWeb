'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // day_group 컬럼 추가 (이미 존재하면 무시)
    try {
      await queryInterface.addColumn('item_slots', 'day_group', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
        comment: '일 구매건수 그룹 번호 (1, 2, 3...)'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
      console.log('day_group column already exists, skipping...');
    }

    // upload_link_token 컬럼 추가 (이미 존재하면 무시)
    try {
      await queryInterface.addColumn('item_slots', 'upload_link_token', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '그룹별 이미지 업로드 링크 토큰'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
      console.log('upload_link_token column already exists, skipping...');
    }

    // 인덱스 추가 (이미 존재하면 무시)
    try {
      await queryInterface.addIndex('item_slots', ['day_group'], {
        name: 'item_slots_day_group_idx'
      });
    } catch (error) {
      console.log('day_group index already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('item_slots', ['upload_link_token'], {
        name: 'item_slots_upload_link_token_idx'
      });
    } catch (error) {
      console.log('upload_link_token index already exists, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('item_slots', 'day_group');
    } catch (error) {
      console.log('day_group column does not exist, skipping...');
    }
    try {
      await queryInterface.removeColumn('item_slots', 'upload_link_token');
    } catch (error) {
      console.log('upload_link_token column does not exist, skipping...');
    }
  }
};
