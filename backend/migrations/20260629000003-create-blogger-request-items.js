'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [tables] = await queryInterface.sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'blogger_request_items'
    `);

    if (tables.length === 0) {
      await queryInterface.createTable('blogger_request_items', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        request_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'blogger_requests', key: 'id' },
          onDelete: 'CASCADE',
          comment: '협의 요청 ID'
        },
        blogger_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'bloggers', key: 'id' },
          onDelete: 'CASCADE',
          comment: '블로거 ID'
        },
        participation_status: {
          type: Sequelize.TEXT,
          allowNull: false,
          defaultValue: 'pending',
          comment: 'pending / accepted / declined'
        },
        product_provision: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '항목별 제품 제공 방식 (없으면 request 기본 상속)'
        },
        unit_price: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '협의 단가 (TEXT)'
        },
        shipping_address: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '협찬 배송 주소'
        },
        submission_url: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '작성 글 링크 (Phase 3)'
        },
        submitted_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: '작성 링크 제출 일자'
        },
        submit_token: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: '공개 제출 링크용 토큰 (UUID)'
        },
        admin_memo: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '항목별 CS 메모'
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

    await addIndexIfNotExists('blogger_request_items', ['request_id'], { name: 'idx_bri_request' });
    await addIndexIfNotExists('blogger_request_items', ['blogger_id'], { name: 'idx_bri_blogger' });
    await addIndexIfNotExists('blogger_request_items', ['submit_token'], { name: 'idx_bri_submit_token' });
    await addIndexIfNotExists('blogger_request_items', ['deleted_at'], { name: 'idx_bri_deleted_at' });
    await addIndexIfNotExists('blogger_request_items', ['request_id', 'blogger_id'], {
      unique: true,
      name: 'unique_bri_request_blogger'
    });

    console.log('blogger_request_items 테이블 생성 완료');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('blogger_request_items');
  }
};
