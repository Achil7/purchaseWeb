'use strict';

/**
 * Soft Delete 마이그레이션
 * 주요 테이블에 deleted_at 컬럼 추가
 * 삭제 시 실제 삭제 대신 deleted_at에 날짜 기록
 * 30일 후 자동 영구 삭제
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. monthly_brands 테이블
    await queryInterface.addColumn('monthly_brands', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // 2. campaigns 테이블
    await queryInterface.addColumn('campaigns', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // 3. items 테이블
    await queryInterface.addColumn('items', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // 4. item_slots 테이블
    await queryInterface.addColumn('item_slots', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // 5. buyers 테이블
    await queryInterface.addColumn('buyers', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // 6. images 테이블
    await queryInterface.addColumn('images', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // 7. users 테이블
    await queryInterface.addColumn('users', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // 인덱스 추가 (soft delete 쿼리 성능 향상)
    await queryInterface.addIndex('monthly_brands', ['deleted_at'], {
      name: 'idx_monthly_brands_deleted_at'
    });
    await queryInterface.addIndex('campaigns', ['deleted_at'], {
      name: 'idx_campaigns_deleted_at'
    });
    await queryInterface.addIndex('items', ['deleted_at'], {
      name: 'idx_items_deleted_at'
    });
    await queryInterface.addIndex('item_slots', ['deleted_at'], {
      name: 'idx_item_slots_deleted_at'
    });
    await queryInterface.addIndex('buyers', ['deleted_at'], {
      name: 'idx_buyers_deleted_at'
    });
    await queryInterface.addIndex('images', ['deleted_at'], {
      name: 'idx_images_deleted_at'
    });
    await queryInterface.addIndex('users', ['deleted_at'], {
      name: 'idx_users_deleted_at'
    });
  },

  async down(queryInterface, Sequelize) {
    // 인덱스 제거
    await queryInterface.removeIndex('monthly_brands', 'idx_monthly_brands_deleted_at');
    await queryInterface.removeIndex('campaigns', 'idx_campaigns_deleted_at');
    await queryInterface.removeIndex('items', 'idx_items_deleted_at');
    await queryInterface.removeIndex('item_slots', 'idx_item_slots_deleted_at');
    await queryInterface.removeIndex('buyers', 'idx_buyers_deleted_at');
    await queryInterface.removeIndex('images', 'idx_images_deleted_at');
    await queryInterface.removeIndex('users', 'idx_users_deleted_at');

    // 컬럼 제거
    await queryInterface.removeColumn('monthly_brands', 'deleted_at');
    await queryInterface.removeColumn('campaigns', 'deleted_at');
    await queryInterface.removeColumn('items', 'deleted_at');
    await queryInterface.removeColumn('item_slots', 'deleted_at');
    await queryInterface.removeColumn('buyers', 'deleted_at');
    await queryInterface.removeColumn('images', 'deleted_at');
    await queryInterface.removeColumn('users', 'deleted_at');
  }
};
