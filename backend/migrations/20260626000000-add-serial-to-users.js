'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. serial 컬럼 추가 (브랜드 일련번호 BR0001, unique → 자동 unique 인덱스)
    await queryInterface.addColumn('users', 'serial', {
      type: Sequelize.STRING(10),
      allowNull: true,
      unique: true,
      comment: '브랜드사 일련번호 (BR0001 형식, 견적서 매칭키)'
    });

    // 2. 기존 브랜드사 backfill (created_at 순으로 BR0001..)
    const brands = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'brand' AND serial IS NULL ORDER BY created_at ASC, id ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (let i = 0; i < brands.length; i++) {
      const serial = 'BR' + String(i + 1).padStart(4, '0');
      await queryInterface.sequelize.query(
        `UPDATE users SET serial = :serial WHERE id = :id`,
        { replacements: { serial, id: brands[i].id } }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'serial');
  }
};
