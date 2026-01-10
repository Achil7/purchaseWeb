'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // monthly_brands 테이블에 is_hidden 추가
    await queryInterface.addColumn('monthly_brands', 'is_hidden', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: '숨김 여부'
    });

    // campaigns 테이블에 is_hidden 추가
    await queryInterface.addColumn('campaigns', 'is_hidden', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: '숨김 여부'
    });

    // 인덱스 추가
    await queryInterface.addIndex('monthly_brands', ['is_hidden']);
    await queryInterface.addIndex('campaigns', ['is_hidden']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('campaigns', ['is_hidden']);
    await queryInterface.removeIndex('monthly_brands', ['is_hidden']);
    await queryInterface.removeColumn('campaigns', 'is_hidden');
    await queryInterface.removeColumn('monthly_brands', 'is_hidden');
  }
};
