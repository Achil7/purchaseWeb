'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      campaign_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'campaigns',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      product_name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      shipping_type: {
        type: Sequelize.ENUM('실출고', '미출고')
      },
      keyword: {
        type: Sequelize.STRING(200)
      },
      total_purchase_count: {
        type: Sequelize.INTEGER
      },
      daily_purchase_count: {
        type: Sequelize.INTEGER
      },
      product_url: {
        type: Sequelize.TEXT
      },
      purchase_option: {
        type: Sequelize.STRING(100)
      },
      product_price: {
        type: Sequelize.DECIMAL(10, 2)
      },
      shipping_deadline: {
        type: Sequelize.DATE
      },
      review_guide: {
        type: Sequelize.TEXT
      },
      courier_service_yn: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      notes: {
        type: Sequelize.TEXT
      },
      upload_link_token: {
        type: Sequelize.STRING(100),
        unique: true
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

    await queryInterface.addIndex('items', ['campaign_id']);
    await queryInterface.addIndex('items', ['upload_link_token']);
    await queryInterface.addIndex('items', ['status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('items');
  }
};
