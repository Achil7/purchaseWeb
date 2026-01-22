'use strict';

/**
 * Image 테이블에 재제출 관련 필드 추가
 * - status: 'pending' | 'approved' | 'rejected' (재제출 승인 상태)
 * - resubmitted_at: 재제출 시간
 * - previous_image_id: 이전 이미지 ID (재제출인 경우)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // status 컬럼 추가 (TEXT 타입, 기존 이미지는 'approved'로 설정)
    await queryInterface.addColumn('images', 'status', {
      type: Sequelize.TEXT,
      defaultValue: 'approved',
      allowNull: false,
      comment: '승인 상태 (pending: 대기, approved: 승인, rejected: 거절)'
    });

    // resubmitted_at 컬럼 추가
    await queryInterface.addColumn('images', 'resubmitted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: '재제출 시간'
    });

    // previous_image_id 컬럼 추가
    await queryInterface.addColumn('images', 'previous_image_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'images',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: '재제출인 경우 이전 이미지 ID'
    });

    // 인덱스 추가
    await queryInterface.addIndex('images', ['status'], {
      name: 'idx_images_status'
    });

    await queryInterface.addIndex('images', ['previous_image_id'], {
      name: 'idx_images_previous_image_id'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('images', 'idx_images_previous_image_id');
    await queryInterface.removeIndex('images', 'idx_images_status');
    await queryInterface.removeColumn('images', 'previous_image_id');
    await queryInterface.removeColumn('images', 'resubmitted_at');
    await queryInterface.removeColumn('images', 'status');
  }
};
