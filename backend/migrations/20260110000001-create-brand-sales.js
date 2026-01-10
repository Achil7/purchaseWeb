'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. brand_sales 테이블 생성 (이미 존재하면 스킵)
    const [tables] = await queryInterface.sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'brand_sales'
    `);

    if (tables.length === 0) {
      await queryInterface.createTable('brand_sales', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
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
        sales_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          comment: '영업사 사용자 ID'
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'SET NULL',
          comment: '할당한 사용자 ID (Admin 또는 영업사 본인)'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    }

    // 2. 인덱스 추가 (이미 존재하면 스킵)
    const addIndexIfNotExists = async (tableName, columns, options) => {
      try {
        await queryInterface.addIndex(tableName, columns, options);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log(`Index ${options.name} already exists, skipping...`);
      }
    };

    await addIndexIfNotExists('brand_sales', ['brand_id'], {
      name: 'idx_brand_sales_brand'
    });
    await addIndexIfNotExists('brand_sales', ['sales_id'], {
      name: 'idx_brand_sales_sales'
    });
    await addIndexIfNotExists('brand_sales', ['brand_id', 'sales_id'], {
      unique: true,
      name: 'unique_brand_sales'
    });

    // 3. 기존 assigned_sales_id 데이터 마이그레이션
    // 브랜드 역할 사용자 중 assigned_sales_id가 설정된 경우 → brand_sales에 추가
    await queryInterface.sequelize.query(`
      INSERT INTO brand_sales (brand_id, sales_id, created_by, created_at)
      SELECT id, assigned_sales_id, assigned_sales_id, created_at
      FROM users
      WHERE role = 'brand' AND assigned_sales_id IS NOT NULL
      ON CONFLICT (brand_id, sales_id) DO NOTHING
    `);

    console.log('brand_sales 테이블 생성 및 기존 데이터 마이그레이션 완료');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('brand_sales');
  }
};
