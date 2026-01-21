'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('estimates', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      file_name: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      company_name: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      company_contact: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      company_tel: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      company_email: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      agency_name: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      agency_representative: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      agency_tel: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      agency_email: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category_review: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      category_product: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      category_delivery: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      category_other: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      supply_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      vat_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      items_json: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      estimate_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      memo: {
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
    await queryInterface.addIndex('estimates', ['uploaded_by']);
    await queryInterface.addIndex('estimates', ['estimate_date']);
    await queryInterface.addIndex('estimates', ['company_name']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('estimates');
  }
};
