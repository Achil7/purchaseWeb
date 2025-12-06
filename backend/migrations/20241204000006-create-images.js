'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('images', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      buyer_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'buyers',
          key: 'id'
        },
        onDelete: 'CASCADE'
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
      title: {
        type: Sequelize.STRING(200)
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      s3_key: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      s3_url: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      file_size: {
        type: Sequelize.INTEGER
      },
      mime_type: {
        type: Sequelize.STRING(50)
      },
      upload_token: {
        type: Sequelize.STRING(100)
      },
      uploaded_by_ip: {
        type: Sequelize.STRING(50)
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('images', ['buyer_id']);
    await queryInterface.addIndex('images', ['item_id']);
    await queryInterface.addIndex('images', ['upload_token']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('images');
  }
};
