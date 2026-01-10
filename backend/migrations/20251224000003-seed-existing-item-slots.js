'use strict';

/**
 * 기존 품목들에 대해 ItemSlot 생성
 * - total_purchase_count 개수만큼 슬롯 생성
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 기존 품목 조회
    const items = await queryInterface.sequelize.query(
      `SELECT id, product_name, purchase_option, keyword, product_price, notes, total_purchase_count
       FROM items
       WHERE total_purchase_count > 0`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${items.length} items to process`);

    for (const item of items) {
      // 이미 슬롯이 있는지 확인
      const existingSlots = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM item_slots WHERE item_id = ${item.id}`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (parseInt(existingSlots[0].count) > 0) {
        console.log(`Item ${item.id} already has slots, skipping`);
        continue;
      }

      // 슬롯 생성
      const slotCount = item.total_purchase_count || 0;
      if (slotCount > 0) {
        const values = [];
        for (let i = 1; i <= slotCount; i++) {
          const productName = item.product_name ? `'${item.product_name.replace(/'/g, "''")}'` : 'NULL';
          const purchaseOption = item.purchase_option ? `'${item.purchase_option.replace(/'/g, "''")}'` : 'NULL';
          const keyword = item.keyword ? `'${item.keyword.replace(/'/g, "''")}'` : 'NULL';
          const productPrice = item.product_price || 'NULL';
          const notes = item.notes ? `'${item.notes.replace(/'/g, "''")}'` : 'NULL';

          values.push(`(${item.id}, ${i}, ${productName}, ${purchaseOption}, ${keyword}, ${productPrice}, ${notes}, 'active', NOW(), NOW())`);
        }

        if (values.length > 0) {
          const insertQuery = `
            INSERT INTO item_slots (item_id, slot_number, product_name, purchase_option, keyword, product_price, notes, status, created_at, updated_at)
            VALUES ${values.join(', ')}
          `;

          try {
            await queryInterface.sequelize.query(insertQuery);
            console.log(`Created ${slotCount} slots for item ${item.id}`);
          } catch (error) {
            console.error(`Error creating slots for item ${item.id}:`, error.message);
          }
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // 롤백: 모든 슬롯 삭제 (주의: 데이터 손실)
    // await queryInterface.sequelize.query('DELETE FROM item_slots');
    console.log('Rollback not implemented to prevent data loss');
  }
};
