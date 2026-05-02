'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 구매자 정보(주문번호) 입력 시점 추적용 컬럼
    await queryInterface.addColumn('buyers', 'info_entered_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
      comment: '주문번호가 처음 입력된 시점 (14일 미제출 추적용)'
    });

    // 인덱스 추가 (미제출 탭 조회 성능)
    await queryInterface.addIndex('buyers', ['info_entered_at'], {
      name: 'idx_buyers_info_entered_at'
    });

    // 기존 데이터 백필: order_number가 있는 buyer는 updated_at으로 채움
    await queryInterface.sequelize.query(`
      UPDATE buyers
      SET info_entered_at = updated_at
      WHERE order_number IS NOT NULL
        AND TRIM(order_number) <> ''
        AND info_entered_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('buyers', 'idx_buyers_info_entered_at');
    await queryInterface.removeColumn('buyers', 'info_entered_at');
  }
};
