'use strict';

/**
 * item_slots 테이블의 제한된 컬럼들을 TEXT로 변경
 * - status: ENUM -> TEXT (자유 입력)
 * - product_name: VARCHAR(200) -> TEXT
 * - purchase_option: VARCHAR(100) -> TEXT
 * - keyword: VARCHAR(200) -> TEXT
 * - product_price: DECIMAL(10,2) -> TEXT
 * - expected_buyer: VARCHAR(100) -> TEXT
 * - date: VARCHAR(20) -> TEXT
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // status: ENUM -> TEXT 변경 (PostgreSQL에서 ENUM 타입 변환)
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE item_slots
        ALTER COLUMN status TYPE TEXT
        USING status::TEXT
      `);
      console.log('Changed status to TEXT');
    } catch (error) {
      console.log('status change error:', error.message);
    }

    // product_name: VARCHAR(200) -> TEXT
    try {
      await queryInterface.changeColumn('item_slots', 'product_name', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('Changed product_name to TEXT');
    } catch (error) {
      console.log('product_name change error:', error.message);
    }

    // purchase_option: VARCHAR(100) -> TEXT
    try {
      await queryInterface.changeColumn('item_slots', 'purchase_option', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('Changed purchase_option to TEXT');
    } catch (error) {
      console.log('purchase_option change error:', error.message);
    }

    // keyword: VARCHAR(200) -> TEXT
    try {
      await queryInterface.changeColumn('item_slots', 'keyword', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('Changed keyword to TEXT');
    } catch (error) {
      console.log('keyword change error:', error.message);
    }

    // product_price: DECIMAL(10,2) -> TEXT
    try {
      await queryInterface.changeColumn('item_slots', 'product_price', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('Changed product_price to TEXT');
    } catch (error) {
      console.log('product_price change error:', error.message);
    }

    // expected_buyer: VARCHAR(100) -> TEXT
    try {
      await queryInterface.changeColumn('item_slots', 'expected_buyer', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('Changed expected_buyer to TEXT');
    } catch (error) {
      console.log('expected_buyer change error:', error.message);
    }

    // date: VARCHAR(20) -> TEXT
    try {
      await queryInterface.changeColumn('item_slots', 'date', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('Changed date to TEXT');
    } catch (error) {
      console.log('date change error:', error.message);
    }

    // upload_link_token: VARCHAR(100) -> TEXT
    try {
      await queryInterface.changeColumn('item_slots', 'upload_link_token', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('Changed upload_link_token to TEXT');
    } catch (error) {
      console.log('upload_link_token change error:', error.message);
    }

    // review_cost: INTEGER -> TEXT
    try {
      await queryInterface.changeColumn('item_slots', 'review_cost', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('Changed review_cost to TEXT');
    } catch (error) {
      console.log('review_cost change error:', error.message);
    }

    // ENUM 타입 삭제 (PostgreSQL)
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_item_slots_status" CASCADE;');
      console.log('Dropped enum_item_slots_status type');
    } catch (error) {
      console.log('enum drop error:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // 롤백: TEXT -> 원래 타입으로 복원
    await queryInterface.changeColumn('item_slots', 'product_name', {
      type: Sequelize.STRING(200),
      allowNull: true
    });

    await queryInterface.changeColumn('item_slots', 'purchase_option', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.changeColumn('item_slots', 'keyword', {
      type: Sequelize.STRING(200),
      allowNull: true
    });

    await queryInterface.changeColumn('item_slots', 'product_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });

    await queryInterface.changeColumn('item_slots', 'expected_buyer', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.changeColumn('item_slots', 'date', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    await queryInterface.changeColumn('item_slots', 'upload_link_token', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.changeColumn('item_slots', 'review_cost', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // status ENUM 복원
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_item_slots_status" AS ENUM('active', 'completed', 'cancelled');
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE item_slots
      ALTER COLUMN status TYPE "enum_item_slots_status"
      USING status::"enum_item_slots_status"
    `);
  }
};
