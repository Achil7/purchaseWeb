'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('campaign_operators', {
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
      item_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'items',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      operator_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      assigned_by: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      assigned_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('campaign_operators', ['campaign_id']);
    await queryInterface.addIndex('campaign_operators', ['item_id']);
    await queryInterface.addIndex('campaign_operators', ['operator_id']);
    await queryInterface.addConstraint('campaign_operators', {
      fields: ['campaign_id', 'item_id', 'operator_id'],
      type: 'unique',
      name: 'unique_campaign_operator'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('campaign_operators');
  }
};
