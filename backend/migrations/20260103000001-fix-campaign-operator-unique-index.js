'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 기존 유니크 제약조건 삭제 (campaign_id, item_id, operator_id)
    // 이 제약조건이 day_group을 포함하지 않아서 같은 진행자가 다른 일차에 배정되지 못함
    try {
      await queryInterface.removeConstraint('campaign_operators', 'unique_campaign_operator');
      console.log('Removed old unique constraint: unique_campaign_operator');
    } catch (error) {
      console.log('Old constraint unique_campaign_operator not found or already removed:', error.message);
    }

    // 2. 기존 인덱스도 삭제 시도
    try {
      await queryInterface.removeIndex('campaign_operators', 'unique_campaign_operator');
      console.log('Removed old index: unique_campaign_operator');
    } catch (error) {
      console.log('Old index unique_campaign_operator not found:', error.message);
    }

    // 3. 새로운 유니크 인덱스 추가 (campaign_id, item_id, day_group, operator_id)
    // day_group을 포함하여 같은 진행자가 같은 품목의 다른 일차에 배정될 수 있도록 함
    try {
      await queryInterface.addIndex('campaign_operators', {
        fields: ['campaign_id', 'item_id', 'day_group', 'operator_id'],
        unique: true,
        name: 'unique_campaign_operator_daygroup'
      });
      console.log('Added new unique index: unique_campaign_operator_daygroup');
    } catch (error) {
      console.log('New index already exists or error:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // 롤백: 새 인덱스 삭제하고 기존 인덱스 복원
    try {
      await queryInterface.removeIndex('campaign_operators', 'unique_campaign_operator_daygroup');
    } catch (error) {
      console.log('Error removing new index:', error.message);
    }

    try {
      await queryInterface.addIndex('campaign_operators', {
        fields: ['campaign_id', 'item_id', 'operator_id'],
        unique: true,
        name: 'unique_campaign_operator'
      });
    } catch (error) {
      console.log('Error restoring old index:', error.message);
    }
  }
};
