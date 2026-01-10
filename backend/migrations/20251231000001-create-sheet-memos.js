'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sheet_memos', {
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
      sheet_type: {
        type: Sequelize.ENUM('operator', 'sales'),
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      row_index: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      col_index: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: true
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

    // 인덱스 추가
    await queryInterface.addIndex('sheet_memos', ['campaign_id']);
    await queryInterface.addIndex('sheet_memos', ['user_id']);
    await queryInterface.addIndex('sheet_memos', ['sheet_type']);
    await queryInterface.addIndex('sheet_memos', ['campaign_id', 'sheet_type', 'user_id', 'row_index', 'col_index'], {
      unique: true,
      name: 'sheet_memos_unique_cell'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sheet_memos');
  }
};
