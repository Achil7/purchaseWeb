'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Buyer 테이블에 정규화된 계좌번호 컬럼 추가
    await queryInterface.addColumn('buyers', 'account_normalized', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // Buyer 테이블에 임시 구매자 플래그 추가 (선 업로드 케이스)
    await queryInterface.addColumn('buyers', 'is_temporary', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    // Image 테이블에 정규화된 계좌번호 컬럼 추가
    await queryInterface.addColumn('images', 'account_normalized', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // 인덱스 추가
    await queryInterface.addIndex('buyers', ['account_normalized'], {
      name: 'idx_buyers_account_normalized'
    });

    await queryInterface.addIndex('buyers', ['is_temporary'], {
      name: 'idx_buyers_is_temporary'
    });

    await queryInterface.addIndex('images', ['account_normalized'], {
      name: 'idx_images_account_normalized'
    });
  },

  async down(queryInterface, Sequelize) {
    // 인덱스 제거
    await queryInterface.removeIndex('buyers', 'idx_buyers_account_normalized');
    await queryInterface.removeIndex('buyers', 'idx_buyers_is_temporary');
    await queryInterface.removeIndex('images', 'idx_images_account_normalized');

    // 컬럼 제거
    await queryInterface.removeColumn('buyers', 'account_normalized');
    await queryInterface.removeColumn('buyers', 'is_temporary');
    await queryInterface.removeColumn('images', 'account_normalized');
  }
};
