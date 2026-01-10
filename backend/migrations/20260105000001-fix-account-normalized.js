'use strict';

/**
 * 기존 구매자들의 account_normalized 필드를 채워주는 마이그레이션
 * account_info에서 숫자만 추출하여 account_normalized에 저장
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 모든 구매자 조회 (account_info가 있지만 account_normalized가 없는 경우)
    const [buyers] = await queryInterface.sequelize.query(`
      SELECT id, account_info
      FROM buyers
      WHERE account_info IS NOT NULL
        AND account_info != ''
        AND (account_normalized IS NULL OR account_normalized = '')
    `);

    console.log(`Found ${buyers.length} buyers to update`);

    // 각 구매자의 account_normalized 업데이트
    for (const buyer of buyers) {
      // 숫자만 추출 (정규화)
      const normalized = buyer.account_info.replace(/[^0-9]/g, '');

      // 8자리 이상인 경우만 업데이트
      if (normalized.length >= 8) {
        await queryInterface.sequelize.query(`
          UPDATE buyers
          SET account_normalized = :normalized
          WHERE id = :id
        `, {
          replacements: { normalized, id: buyer.id }
        });
        console.log(`Updated buyer ${buyer.id}: ${buyer.account_info} -> ${normalized}`);
      }
    }

    console.log('Migration completed');
  },

  async down(queryInterface, Sequelize) {
    // 롤백: account_normalized를 NULL로 설정 (선택적)
    // await queryInterface.sequelize.query(`
    //   UPDATE buyers SET account_normalized = NULL
    // `);
  }
};
