'use strict';

module.exports = {
  async up(queryInterface) {
    // images 테이블: buyer_id + status 복합 인덱스 (리뷰 통계 쿼리 최적화)
    await queryInterface.addIndex('images', ['buyer_id', 'status'], {
      name: 'idx_images_buyer_id_status'
    });

    // item_slots 테이블: buyer_id + item_id 복합 인덱스 (구매자 통계 쿼리 최적화)
    await queryInterface.addIndex('item_slots', ['buyer_id', 'item_id'], {
      name: 'idx_item_slots_buyer_id_item_id'
    });

    // item_slots 테이블: upload_link_token 인덱스 (토큰 검색 최적화)
    await queryInterface.addIndex('item_slots', ['upload_link_token'], {
      name: 'idx_item_slots_upload_link_token'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('images', 'idx_images_buyer_id_status');
    await queryInterface.removeIndex('item_slots', 'idx_item_slots_buyer_id_item_id');
    await queryInterface.removeIndex('item_slots', 'idx_item_slots_upload_link_token');
  }
};
