'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [tables] = await queryInterface.sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'blogger_requests'
    `);

    if (tables.length === 0) {
      await queryInterface.createTable('blogger_requests', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        brand_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          comment: '요청한 브랜드사 사용자 ID'
        },
        campaign_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'campaigns', key: 'id' },
          onDelete: 'SET NULL',
          comment: '연관 캠페인 (선택)'
        },
        status: {
          type: Sequelize.TEXT,
          allowNull: false,
          defaultValue: 'requested',
          comment: 'requested / reviewing / in_progress / completed / cancelled'
        },
        product_provision: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'sponsored(협찬) / self_purchase(내돈내산) - 기본값, 항목별 override 가능'
        },
        guide_text: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '브랜드 가이드(키워드/소구점 등)'
        },
        brand_memo: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '브랜드 요청 메모'
        },
        admin_memo: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'kwad CS 메모'
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
          comment: '생성자 (브랜드 본인 또는 admin 대리)'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true
        }
      });
    }

    const addIndexIfNotExists = async (tableName, columns, options) => {
      try {
        await queryInterface.addIndex(tableName, columns, options);
      } catch (error) {
        if (!error.message.includes('already exists')) throw error;
        console.log(`Index ${options.name} already exists, skipping...`);
      }
    };

    await addIndexIfNotExists('blogger_requests', ['brand_id'], { name: 'idx_blogger_requests_brand' });
    await addIndexIfNotExists('blogger_requests', ['status'], { name: 'idx_blogger_requests_status' });
    await addIndexIfNotExists('blogger_requests', ['deleted_at'], { name: 'idx_blogger_requests_deleted_at' });

    console.log('blogger_requests 테이블 생성 완료');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('blogger_requests');
  }
};
