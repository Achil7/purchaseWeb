'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // items 테이블: 택배대행이 정확히 'Y'가 아닌 경우 courier_name을 NULL로 변경
    // TRIM과 UPPER로 공백 제거 및 대소문자 무시
    await queryInterface.sequelize.query(`
      UPDATE items
      SET courier_name = NULL
      WHERE UPPER(TRIM(COALESCE(courier_service_yn, ''))) != 'Y'
        AND courier_name IS NOT NULL
    `);
    console.log(`Updated items table: cleared courier_name where courier_service_yn != 'Y'`);

    // item_slots 테이블: 택배대행이 정확히 'Y'가 아닌 경우 courier_name을 NULL로 변경
    await queryInterface.sequelize.query(`
      UPDATE item_slots
      SET courier_name = NULL
      WHERE UPPER(TRIM(COALESCE(courier_service_yn, ''))) != 'Y'
        AND courier_name IS NOT NULL
    `);
    console.log(`Updated item_slots table: cleared courier_name where courier_service_yn != 'Y'`);
  },

  async down(queryInterface, Sequelize) {
    // 롤백: 택배대행이 'Y'가 아닌 경우 다시 '롯데택배'로 설정
    await queryInterface.sequelize.query(`
      UPDATE items
      SET courier_name = '롯데택배'
      WHERE UPPER(TRIM(COALESCE(courier_service_yn, ''))) != 'Y'
        AND courier_name IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE item_slots
      SET courier_name = '롯데택배'
      WHERE UPPER(TRIM(COALESCE(courier_service_yn, ''))) != 'Y'
        AND courier_name IS NULL
    `);
    console.log('Restored courier_name to 롯데택배 for non-courier-service items/slots');
  }
};
