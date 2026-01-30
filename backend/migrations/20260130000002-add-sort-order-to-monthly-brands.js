'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. sort_order 컬럼 추가
    await queryInterface.addColumn('monthly_brands', 'sort_order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '정렬 순서 (낮을수록 위에 표시)'
    });

    // 2. 기존 데이터에 sort_order 초기화 (created_at ASC 순서로)
    // 영업사(created_by)별로 그룹화하여 순서 부여
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY created_by ORDER BY created_at ASC) as rn
        FROM monthly_brands
        WHERE deleted_at IS NULL
      )
      UPDATE monthly_brands
      SET sort_order = ranked.rn
      FROM ranked
      WHERE monthly_brands.id = ranked.id
    `);

    // 3. 인덱스 추가 (created_by + sort_order로 정렬 시 성능 향상)
    await queryInterface.addIndex('monthly_brands', ['created_by', 'sort_order'], {
      name: 'idx_monthly_brands_created_by_sort_order'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('monthly_brands', 'idx_monthly_brands_created_by_sort_order');
    await queryInterface.removeColumn('monthly_brands', 'sort_order');
  }
};
