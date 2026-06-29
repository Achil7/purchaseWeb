'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. bloggers 테이블 생성 (이미 존재하면 스킵)
    const [tables] = await queryInterface.sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'bloggers'
    `);

    if (tables.length === 0) {
      await queryInterface.createTable('bloggers', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        activity_name: {
          type: Sequelize.STRING(200),
          allowNull: false,
          comment: '활동명'
        },
        blog_url: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '블로그 주소'
        },
        daily_visitors: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '평균 1일 방문자 수 (TEXT 정책)'
        },
        main_content: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: '주요 콘텐츠'
        },
        memo: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'admin 내부 메모 (브랜드 비노출)'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: '브랜드 노출 여부'
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: '목록 정렬 순서'
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'SET NULL',
          comment: '등록한 admin 사용자 ID'
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

    await addIndexIfNotExists('bloggers', ['is_active'], {
      name: 'idx_bloggers_is_active'
    });
    await addIndexIfNotExists('bloggers', ['sort_order'], {
      name: 'idx_bloggers_sort_order'
    });
    await addIndexIfNotExists('bloggers', ['deleted_at'], {
      name: 'idx_bloggers_deleted_at'
    });

    console.log('bloggers 테이블 생성 완료');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bloggers');
  }
};
