'use strict';

/**
 * 성능 최적화를 위한 복합 인덱스 추가
 * - COUNT 쿼리 최적화
 * - JOIN 쿼리 최적화
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const indexConfigs = [
      // buyers 테이블 - is_temporary 필터링 + item_id 그룹핑에 사용
      {
        table: 'buyers',
        fields: ['item_id', 'is_temporary'],
        name: 'idx_buyers_item_id_is_temporary'
      },
      // item_slots 테이블 - day_group 기반 조회 최적화
      {
        table: 'item_slots',
        fields: ['item_id', 'day_group'],
        name: 'idx_item_slots_item_id_day_group'
      },
      // item_slots 테이블 - 날짜 기반 조회 최적화
      {
        table: 'item_slots',
        fields: ['date'],
        name: 'idx_item_slots_date'
      },
      // campaign_operators 테이블 - operator_id + day_group 복합 조회
      {
        table: 'campaign_operators',
        fields: ['operator_id', 'day_group'],
        name: 'idx_campaign_operators_operator_day_group'
      },
      // campaign_operators 테이블 - item_id + day_group 복합 조회
      {
        table: 'campaign_operators',
        fields: ['item_id', 'day_group'],
        name: 'idx_campaign_operators_item_day_group'
      },
      // campaigns 테이블 - created_by 조회 최적화 (Sales용)
      {
        table: 'campaigns',
        fields: ['created_by'],
        name: 'idx_campaigns_created_by'
      },
      // campaigns 테이블 - brand_id 조회 최적화 (Brand용)
      {
        table: 'campaigns',
        fields: ['brand_id'],
        name: 'idx_campaigns_brand_id'
      },
      // campaigns 테이블 - monthly_brand_id 조회 최적화
      {
        table: 'campaigns',
        fields: ['monthly_brand_id'],
        name: 'idx_campaigns_monthly_brand_id'
      },
      // items 테이블 - campaign_id 조회 최적화
      {
        table: 'items',
        fields: ['campaign_id'],
        name: 'idx_items_campaign_id'
      },
      // images 테이블 - created_at 정렬 최적화
      {
        table: 'images',
        fields: ['buyer_id', 'created_at'],
        name: 'idx_images_buyer_id_created_at'
      }
    ];

    for (const config of indexConfigs) {
      try {
        await queryInterface.addIndex(config.table, config.fields, {
          name: config.name
        });
        console.log(`Created index: ${config.name}`);
      } catch (error) {
        // 이미 존재하는 인덱스는 스킵
        if (error.message.includes('already exists') || error.name === 'SequelizeDatabaseError') {
          console.log(`Index ${config.name} already exists, skipping...`);
        } else {
          console.error(`Failed to create index ${config.name}:`, error.message);
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const indexNames = [
      { table: 'buyers', name: 'idx_buyers_item_id_is_temporary' },
      { table: 'item_slots', name: 'idx_item_slots_item_id_day_group' },
      { table: 'item_slots', name: 'idx_item_slots_date' },
      { table: 'campaign_operators', name: 'idx_campaign_operators_operator_day_group' },
      { table: 'campaign_operators', name: 'idx_campaign_operators_item_day_group' },
      { table: 'campaigns', name: 'idx_campaigns_created_by' },
      { table: 'campaigns', name: 'idx_campaigns_brand_id' },
      { table: 'campaigns', name: 'idx_campaigns_monthly_brand_id' },
      { table: 'items', name: 'idx_items_campaign_id' },
      { table: 'images', name: 'idx_images_buyer_id_created_at' }
    ];

    for (const idx of indexNames) {
      try {
        await queryInterface.removeIndex(idx.table, idx.name);
        console.log(`Removed index: ${idx.name}`);
      } catch (error) {
        console.log(`Index ${idx.name} may not exist: ${error.message}`);
      }
    }
  }
};
