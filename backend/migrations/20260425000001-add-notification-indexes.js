'use strict';

module.exports = {
  async up(queryInterface) {
    // notifications 테이블 - user_id + is_read 복합 인덱스 (안 읽은 알림 COUNT 최적화)
    await queryInterface.addIndex('notifications', ['user_id', 'is_read'], {
      name: 'idx_notifications_user_id_is_read'
    });

    // notifications 테이블 - user_id + created_at 복합 인덱스 (정렬 + 필터)
    await queryInterface.addIndex('notifications', ['user_id', 'created_at'], {
      name: 'idx_notifications_user_id_created_at'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notifications', 'idx_notifications_user_id_is_read');
    await queryInterface.removeIndex('notifications', 'idx_notifications_user_id_created_at');
  }
};
