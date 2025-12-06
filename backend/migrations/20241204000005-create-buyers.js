'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('buyers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'items',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      order_number: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      buyer_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      recipient_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      user_id: {
        type: Sequelize.STRING(100)
      },
      contact: {
        type: Sequelize.STRING(50)
      },
      address: {
        type: Sequelize.TEXT
      },
      account_info: {
        type: Sequelize.STRING(200)
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2)
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'completed'),
        defaultValue: 'pending'
      },
      payment_confirmed_by: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      payment_confirmed_at: {
        type: Sequelize.DATE
      },
      notes: {
        type: Sequelize.TEXT
      },
      created_by: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
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

    await queryInterface.addIndex('buyers', ['item_id']);
    await queryInterface.addIndex('buyers', ['order_number']);
    await queryInterface.addIndex('buyers', ['payment_status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('buyers');
  }
};
