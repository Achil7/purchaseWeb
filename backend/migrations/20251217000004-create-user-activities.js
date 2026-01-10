'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 테이블이 이미 존재하는지 확인
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_activities')`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (tableExists[0].exists) {
      console.log('user_activities table already exists, skipping creation');
      return;
    }

    // user_activities 테이블 생성
    await queryInterface.createTable('user_activities', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      activity_type: {
        type: Sequelize.ENUM('login', 'logout', 'heartbeat'),
        allowNull: false
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 인덱스 추가 (이름 명시하여 중복 방지)
    try {
      await queryInterface.addIndex('user_activities', ['user_id'], { name: 'idx_user_activities_user_id' });
      await queryInterface.addIndex('user_activities', ['activity_type'], { name: 'idx_user_activities_activity_type' });
      await queryInterface.addIndex('user_activities', ['created_at'], { name: 'idx_user_activities_created_at' });
    } catch (e) {
      console.log('Some indexes may already exist, continuing...');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_activities');
  }
};
