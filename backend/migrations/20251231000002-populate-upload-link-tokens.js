'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // upload_link_token이 NULL인 슬롯들 조회
    const [slots] = await queryInterface.sequelize.query(`
      SELECT id, item_id, day_group
      FROM item_slots
      WHERE upload_link_token IS NULL
      ORDER BY item_id, day_group, slot_number
    `);

    if (slots.length === 0) {
      console.log('No slots with NULL upload_link_token found.');
      return;
    }

    console.log(`Found ${slots.length} slots with NULL upload_link_token`);

    // item_id와 day_group으로 그룹핑하여 같은 그룹은 같은 토큰 사용
    const tokenMap = new Map(); // "item_id_day_group" -> token

    for (const slot of slots) {
      const groupKey = `${slot.item_id}_${slot.day_group || 1}`;

      if (!tokenMap.has(groupKey)) {
        tokenMap.set(groupKey, uuidv4());
      }

      const token = tokenMap.get(groupKey);

      await queryInterface.sequelize.query(`
        UPDATE item_slots
        SET upload_link_token = :token
        WHERE id = :id
      `, {
        replacements: { token, id: slot.id }
      });
    }

    console.log(`Updated ${slots.length} slots with upload_link_tokens (${tokenMap.size} unique tokens)`);
  },

  async down(queryInterface, Sequelize) {
    // 롤백 시 모든 토큰 제거 (선택적)
    // await queryInterface.sequelize.query(`
    //   UPDATE item_slots SET upload_link_token = NULL
    // `);
    console.log('Rollback: No changes made (tokens preserved)');
  }
};
