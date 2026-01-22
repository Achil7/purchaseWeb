'use strict';

/**
 * 구매자에 입금 예정일 및 리뷰 제출일 필드 추가
 * - expected_payment_date: 다음 영업일 기준 입금 예정일
 * - review_submitted_at: 리뷰 이미지 제출 시간
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // expected_payment_date 컬럼 추가
    await queryInterface.addColumn('buyers', 'expected_payment_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: '입금 예정일 (다음 영업일 기준)'
    });

    // review_submitted_at 컬럼 추가
    await queryInterface.addColumn('buyers', 'review_submitted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: '리뷰 이미지 제출 시간'
    });

    // 인덱스 추가
    await queryInterface.addIndex('buyers', ['expected_payment_date'], {
      name: 'idx_buyers_expected_payment_date'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('buyers', 'idx_buyers_expected_payment_date');
    await queryInterface.removeColumn('buyers', 'review_submitted_at');
    await queryInterface.removeColumn('buyers', 'expected_payment_date');
  }
};
