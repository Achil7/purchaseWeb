'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Buyer 테이블에 date 컬럼 추가
    await queryInterface.addColumn('buyers', 'date', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // 2. date 컬럼에 인덱스 추가
    await queryInterface.addIndex('buyers', ['date'], {
      name: 'buyers_date_idx'
    });

    // 3. 기존 데이터 마이그레이션: ItemSlot.date -> Buyer.date
    await queryInterface.sequelize.query(`
      UPDATE buyers b
      SET date = s.date
      FROM item_slots s
      WHERE s.buyer_id = b.id
        AND b.date IS NULL
        AND s.date IS NOT NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('buyers', 'buyers_date_idx');
    await queryInterface.removeColumn('buyers', 'date');
  }
};
