'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. monthly_brands 테이블 생성 (없으면)
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('monthly_brands')) {
      await queryInterface.createTable('monthly_brands', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: '연월브랜드명 (예: 2512어댑트)'
        },
        brand_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          comment: '브랜드 사용자 ID'
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'RESTRICT',
          comment: '생성한 영업사 ID'
        },
        year_month: {
          type: Sequelize.STRING(4),
          allowNull: true,
          comment: '연월 (YYMM 형식, 예: 2512)'
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('active', 'completed', 'cancelled'),
          defaultValue: 'active'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
    }

    // 2. 기존 자동 생성된 인덱스 삭제 (충돌 방지)
    const autoIndexes = ['monthly_brands_brand_id', 'monthly_brands_created_by'];
    for (const idx of autoIndexes) {
      try {
        await queryInterface.removeIndex('monthly_brands', idx);
      } catch (e) {
        // 인덱스 없으면 무시
      }
    }

    // 3. 명시적 이름으로 인덱스 생성
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

    // 4. campaigns 테이블에 monthly_brand_id 컬럼 추가
    const tableInfo = await queryInterface.describeTable('campaigns');
    if (!tableInfo.monthly_brand_id) {
      await queryInterface.addColumn('campaigns', 'monthly_brand_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'monthly_brands',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: '연월브랜드 ID'
      });
    }

    // 5. campaigns 인덱스 추가
    try {
      await queryInterface.addIndex('campaigns', ['monthly_brand_id'], { name: 'idx_campaigns_monthly_brand_id' });
    } catch (e) {
      console.log('Index idx_campaigns_monthly_brand_id already exists, skipping...');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // campaigns 테이블에서 monthly_brand_id 컬럼 제거
    try {
      await queryInterface.removeIndex('campaigns', 'idx_campaigns_monthly_brand_id');
    } catch (e) {}

    try {
      await queryInterface.removeColumn('campaigns', 'monthly_brand_id');
    } catch (e) {}

    // monthly_brands 테이블 삭제
    await queryInterface.dropTable('monthly_brands');
  }
};
