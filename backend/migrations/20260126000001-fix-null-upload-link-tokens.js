'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // upload_link_token이 NULL인 슬롯들 조회
    const [slots] = await queryInterface.sequelize.query(`
      SELECT id, item_id, day_group
      FROM item_slots
      WHERE upload_link_token IS NULL OR upload_link_token = ''
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
      const dayGroup = slot.day_group || 1;
      const groupKey = `${slot.item_id}_${dayGroup}`;

      if (!tokenMap.has(groupKey)) {
        // 먼저 같은 그룹에서 이미 토큰이 있는 슬롯이 있는지 확인
        const [existingTokenSlot] = await queryInterface.sequelize.query(`
          SELECT upload_link_token
          FROM item_slots
          WHERE item_id = :itemId AND day_group = :dayGroup AND upload_link_token IS NOT NULL AND upload_link_token != ''
          LIMIT 1
        `, {
          replacements: { itemId: slot.item_id, dayGroup: dayGroup }
        });

        if (existingTokenSlot && existingTokenSlot.length > 0 && existingTokenSlot[0].upload_link_token) {
          tokenMap.set(groupKey, existingTokenSlot[0].upload_link_token);
        } else {
          tokenMap.set(groupKey, uuidv4());
        }
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
    console.log('Rollback: No changes made (tokens preserved)');
  }
};
