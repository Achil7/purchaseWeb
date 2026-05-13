'use strict';

module.exports = {
  async up(queryInterface) {
    // platform_rankings 테이블 - (category_id, collected_at, rank) 복합 인덱스
    // 캐시 미스 시 첫 호출 (getLatest, getChanges, getInsights) 빠르게
    // 기존 (category_id, collected_at) 복합 인덱스는 유지 (rank만 추가)
    await queryInterface.addIndex('platform_rankings', ['category_id', 'collected_at', 'rank'], {
      name: 'idx_platform_rankings_category_collected_rank'
    });

    // (goods_no, collected_at) 복합 인덱스 - getHistory, getMyChanges에서 활용
    await queryInterface.addIndex('platform_rankings', ['goods_no', 'collected_at'], {
      name: 'idx_platform_rankings_goods_no_collected'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('platform_rankings', 'idx_platform_rankings_category_collected_rank');
    await queryInterface.removeIndex('platform_rankings', 'idx_platform_rankings_goods_no_collected');
  }
};
