'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // registered_at 필드 추가
    await queryInterface.addColumn('campaigns', 'registered_at', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: '캠페인 등록 날짜'
    });

    // name을 nullable로 변경 (자동생성되므로)
    await queryInterface.changeColumn('campaigns', 'name', {
      type: Sequelize.STRING(200),
      allowNull: true
    });

    // 기존 데이터에 registered_at 설정 (created_at 기준)
    await queryInterface.sequelize.query(
      'UPDATE campaigns SET registered_at = DATE(created_at) WHERE registered_at IS NULL'
    );

    await queryInterface.addIndex('campaigns', ['registered_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('campaigns', ['registered_at']);
    await queryInterface.removeColumn('campaigns', 'registered_at');
    await queryInterface.changeColumn('campaigns', 'name', {
      type: Sequelize.STRING(200),
      allowNull: false
    });
  }
};
