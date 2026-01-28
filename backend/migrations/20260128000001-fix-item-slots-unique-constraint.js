'use strict';

/**
 * item_slots 테이블의 unique 제약 조건 수정
 * 기존: (item_id, slot_number)
 * 변경: (item_id, day_group, slot_number)
 *
 * 이유: day_group별로 slot_number가 별도로 관리되어야 함
 * 예: item_id=1, day_group=1, slot_number=1 과
 *     item_id=1, day_group=2, slot_number=1 은 다른 슬롯
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 기존 unique 인덱스 삭제
    try {
      await queryInterface.removeIndex('item_slots', 'idx_item_slots_item_slot_unique');
      console.log('Removed old index: idx_item_slots_item_slot_unique');
    } catch (error) {
      console.log('Old index may not exist:', error.message);
    }

    // PostgreSQL의 다른 이름으로 존재할 수 있는 제약 조건도 삭제 시도
    try {
      await queryInterface.removeIndex('item_slots', 'item_slots_item_id_slot_number');
      console.log('Removed constraint: item_slots_item_id_slot_number');
    } catch (error) {
      console.log('Constraint item_slots_item_id_slot_number may not exist:', error.message);
    }

    // 새로운 unique 인덱스 추가 (item_id, day_group, slot_number)
    try {
      await queryInterface.addIndex('item_slots', ['item_id', 'day_group', 'slot_number'], {
        name: 'idx_item_slots_item_daygroup_slot_unique',
        unique: true
      });
      console.log('Created new index: idx_item_slots_item_daygroup_slot_unique');
    } catch (error) {
      console.log('Failed to create new index:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // 롤백: 새 인덱스 삭제
    try {
      await queryInterface.removeIndex('item_slots', 'idx_item_slots_item_daygroup_slot_unique');
    } catch (error) {
      console.log('New index may not exist:', error.message);
    }

    // 롤백: 기존 인덱스 복원
    try {
      await queryInterface.addIndex('item_slots', ['item_id', 'slot_number'], {
        name: 'idx_item_slots_item_slot_unique',
        unique: true
      });
    } catch (error) {
      console.log('Failed to restore old index:', error.message);
    }
  }
};
