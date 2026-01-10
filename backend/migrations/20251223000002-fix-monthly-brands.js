'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. 기존 자동 생성된 인덱스 삭제 (존재하면)
    try {
      await queryInterface.removeIndex('monthly_brands', 'monthly_brands_brand_id');
    } catch (e) {
      console.log('Index monthly_brands_brand_id does not exist, skipping...');
    }

    // 2. 새 인덱스 생성 (IF NOT EXISTS 방식으로)
    const indexes = [
      { table: 'monthly_brands', columns: ['brand_id'], name: 'idx_monthly_brands_brand_id' },
      { table: 'monthly_brands', columns: ['created_by'], name: 'idx_monthly_brands_created_by' },
      { table: 'monthly_brands', columns: ['year_month'], name: 'idx_monthly_brands_year_month' },
      { table: 'monthly_brands', columns: ['status'], name: 'idx_monthly_brands_status' }
    ];

    for (const idx of indexes) {
      try {
        await queryInterface.addIndex(idx.table, idx.columns, { name: idx.name });
      } catch (e) {
        console.log(`Index ${idx.name} already exists, skipping...`);
      }
    }

    // 3. campaigns 테이블에 monthly_brand_id 컬럼 추가 (없으면)
    const tableInfo = await queryInterface.describeTable('campaigns');
    if (!tableInfo.monthly_brand_id) {
      await queryInterface.addColumn('campaigns', 'monthly_brand_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'monthly_brands',
          key: 'id'
        },
        onDelete: 'SET NULL'
      });
    }

    // 4. campaigns 인덱스 추가
    try {
      await queryInterface.addIndex('campaigns', ['monthly_brand_id'], { name: 'idx_campaigns_monthly_brand_id' });
    } catch (e) {
      console.log('Index idx_campaigns_monthly_brand_id already exists, skipping...');
    }

    // 5. 기존 마이그레이션 기록 추가 (중복 방지)
    try {
      await queryInterface.sequelize.query(
        `INSERT INTO "SequelizeMeta" (name) VALUES ('20251223000001-create-monthly-brands.js') ON CONFLICT DO NOTHING`
      );
    } catch (e) {
      console.log('Migration record already exists');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 롤백 시 인덱스 삭제
    try {
      await queryInterface.removeIndex('campaigns', 'idx_campaigns_monthly_brand_id');
    } catch (e) {}

    try {
      await queryInterface.removeColumn('campaigns', 'monthly_brand_id');
    } catch (e) {}
  }
};
