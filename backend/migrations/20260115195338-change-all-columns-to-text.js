'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Item 테이블 - 모든 제한된 필드를 TEXT로 변경
    await queryInterface.changeColumn('items', 'total_purchase_count', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'deposit_name', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'date', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'status', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'upload_link_token', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'sale_price_per_unit', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'courier_price_per_unit', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'expense_product', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'expense_courier', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'expense_review', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'expense_other', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Buyer 테이블 - 모든 제한된 필드를 TEXT로 변경
    await queryInterface.changeColumn('buyers', 'order_number', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'buyer_name', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'recipient_name', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'user_id', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'contact', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'account_info', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'account_normalized', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'amount', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'tracking_number', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'courier_company', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Item 테이블 - 원래 타입으로 복원
    await queryInterface.changeColumn('items', 'total_purchase_count', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'deposit_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'date', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'status', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'upload_link_token', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'sale_price_per_unit', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'courier_price_per_unit', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'expense_product', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'expense_courier', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'expense_review', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('items', 'expense_other', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // Buyer 테이블 - 원래 타입으로 복원
    await queryInterface.changeColumn('buyers', 'order_number', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'buyer_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'recipient_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'user_id', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'contact', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'account_info', {
      type: Sequelize.STRING(200),
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'account_normalized', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'amount', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'tracking_number', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.changeColumn('buyers', 'courier_company', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
  }
};
