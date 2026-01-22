'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Buyer 테이블에 deposit_name 컬럼 추가
    await queryInterface.addColumn('buyers', 'deposit_name', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: '구매자별 입금명 (Item.deposit_name에서 이동)'
    });

    // 기존 Item의 deposit_name을 Buyer로 복사
    // 같은 item_id를 가진 모든 buyer에게 해당 item의 deposit_name 복사
    await queryInterface.sequelize.query(`
      UPDATE buyers
      SET deposit_name = items.deposit_name
      FROM items
      WHERE buyers.item_id = items.id
        AND items.deposit_name IS NOT NULL
        AND items.deposit_name != ''
    `);

    console.log('Successfully added deposit_name to buyers table and copied data from items');
  },

  async down(queryInterface, Sequelize) {
    // Buyer 테이블에서 deposit_name 컬럼 제거
    await queryInterface.removeColumn('buyers', 'deposit_name');
    console.log('Successfully removed deposit_name from buyers table');
  }
};
