'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. settlements 테이블
    await queryInterface.createTable('settlements', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      settlement_id: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: '정산ID (예: 260106조이쿠팡)'
      },
      company_name: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '업체명'
      },
      month: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '정산 월 (예: 2026-01)'
      },
      // 매출: 진행비
      rev_processing_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: '매출 진행비 단가'
      },
      rev_processing_qty: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '매출 진행 수량'
      },
      // 매출: 택배대행
      rev_delivery_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: '매출 택배대행 단가'
      },
      rev_delivery_qty: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '매출 택배 수량'
      },
      // 지출: 진행비 실비
      exp_processing_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: '지출 진행비(실비) 단가'
      },
      memo: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '메모'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    await queryInterface.addIndex('settlements', ['settlement_id']);
    await queryInterface.addIndex('settlements', ['month']);
    await queryInterface.addIndex('settlements', ['company_name']);

    // 2. settlement_products 테이블
    await queryInterface.createTable('settlement_products', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      settlement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'settlements',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: '정산 FK'
      },
      product_name: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '제품명'
      },
      product_qty: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '제품 수량'
      },
      product_unit_price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: '제품비 단가'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '정렬 순서'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    await queryInterface.addIndex('settlement_products', ['settlement_id']);

    // 3. margin_settings 테이블
    await queryInterface.createTable('margin_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      key: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
        comment: '설정 키'
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: '설정 값'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // 초기 설정값 삽입
    await queryInterface.bulkInsert('margin_settings', [{
      key: 'delivery_cost_with_vat',
      value: '2750',
      updated_at: new Date()
    }]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('settlement_products');
    await queryInterface.dropTable('settlements');
    await queryInterface.dropTable('margin_settings');
  }
};
