'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('images', 'resubmission_group_id', {
      type: Sequelize.STRING(36),
      allowNull: true,
      comment: '재제출 그룹 ID (UUID) - 같은 구매자가 한번에 재제출한 이미지들은 동일한 그룹 ID를 가짐'
    });

    await queryInterface.addIndex('images', ['resubmission_group_id'], {
      name: 'images_resubmission_group_id_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('images', 'images_resubmission_group_id_idx');
    await queryInterface.removeColumn('images', 'resubmission_group_id');
  }
};
