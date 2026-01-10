'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 테이블이 이미 존재하는지 확인
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'item_slots'
      );`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!tableExists[0].exists) {
      await queryInterface.createTable('item_slots', {
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
        slot_number: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        date: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        product_name: {
          type: Sequelize.STRING(200),
          allowNull: true
        },
        purchase_option: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        keyword: {
          type: Sequelize.STRING(200),
          allowNull: true
        },
        product_price: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('active', 'completed', 'cancelled'),
          defaultValue: 'active'
        },
        buyer_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'buyers',
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
    }

    // 인덱스 추가 (명시적 이름 사용, 에러 무시)
    const indexConfigs = [
      { fields: ['item_id'], name: 'idx_item_slots_item_id' },
      { fields: ['buyer_id'], name: 'idx_item_slots_buyer_id' },
      { fields: ['status'], name: 'idx_item_slots_status' },
      { fields: ['item_id', 'slot_number'], name: 'idx_item_slots_item_slot_unique', unique: true }
    ];

    for (const config of indexConfigs) {
      try {
        await queryInterface.addIndex('item_slots', config.fields, {
          name: config.name,
          unique: config.unique || false
        });
      } catch (error) {
        console.log(`Index ${config.name} may already exist: ${error.message}`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('item_slots');
  }
};
