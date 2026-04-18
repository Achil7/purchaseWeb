'use strict';

module.exports = {
  async up(queryInterface) {
    // campaign_operators 테이블 - campaign_id 단일 인덱스 (monthly-brands/all의 groupBy 최적화)
    await queryInterface.addIndex('campaign_operators', ['campaign_id'], {
      name: 'idx_campaign_operators_campaign_id'
    });

    // campaign_operators 테이블 - campaign_id + item_id + day_group 복합 인덱스 (배정 상태 체크)
    await queryInterface.addIndex('campaign_operators', ['campaign_id', 'item_id', 'day_group'], {
      name: 'idx_campaign_operators_campaign_item_day'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('campaign_operators', 'idx_campaign_operators_campaign_id');
    await queryInterface.removeIndex('campaign_operators', 'idx_campaign_operators_campaign_item_day');
  }
};
