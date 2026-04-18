'use strict';

/**
 * review_extracted_texts 테이블 생성
 *
 * 구매자의 리뷰샷 이미지를 GPT-4o Vision으로 텍스트 추출한 결과 저장
 * - buyer_id 기준 (1 구매자 = 1 행, 여러 이미지 합산)
 * - 업로드 시 자동 추출 + 재제출 승인 시 재추출
 * - 리뷰 분석 보고서 기능의 기반 데이터
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('review_extracted_texts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      buyer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'buyers', key: 'id' },
        onDelete: 'CASCADE',
        comment: '구매자 ID (UNIQUE - 구매자당 1행)'
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'items', key: 'id' },
        onDelete: 'CASCADE',
        comment: '품목 ID (buyer.item_id 복사)'
      },
      campaign_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'campaigns', key: 'id' },
        onDelete: 'SET NULL',
        comment: '캠페인 ID (보고서 조회용)'
      },
      monthly_brand_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'monthly_brands', key: 'id' },
        onDelete: 'SET NULL',
        comment: '연월브랜드 ID (보고서 조회용)'
      },
      extracted_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '추출된 리뷰 본문 (여러 이미지면 \\n\\n로 합침). not_review면 NULL'
      },
      image_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: '추출에 사용된 이미지 수'
      },
      image_ids: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: '추출한 이미지 ID 배열 [101, 102, 103]'
      },
      extraction_status: {
        type: Sequelize.TEXT,
        defaultValue: 'pending',
        allowNull: false,
        comment: 'pending / completed / not_review / failed / skipped'
      },
      tokens_used_input: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'GPT-4o 입력 토큰'
      },
      tokens_used_output: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'GPT-4o 출력 토큰'
      },
      cost_usd: {
        type: Sequelize.DECIMAL(10, 6),
        defaultValue: 0,
        comment: '이번 호출 비용 (USD)'
      },
      model_used: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '사용한 모델명 (예: gpt-4o)'
      },
      detail_used: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '사용한 detail 옵션 (low/high/auto)'
      },
      extraction_error: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '실패 시 에러 메시지'
      },
      last_image_updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '추출 시점의 최신 이미지 created_at (재추출 판단용)'
      },
      extracted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '추출 완료 시각'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // UNIQUE 인덱스 (buyer_id): 구매자당 1행
    await queryInterface.addIndex('review_extracted_texts', ['buyer_id'], {
      name: 'idx_ret_buyer_id_unique',
      unique: true
    });

    // 보고서 조회용 인덱스
    await queryInterface.addIndex('review_extracted_texts', ['item_id'], {
      name: 'idx_ret_item_id'
    });
    await queryInterface.addIndex('review_extracted_texts', ['campaign_id'], {
      name: 'idx_ret_campaign_id'
    });
    await queryInterface.addIndex('review_extracted_texts', ['monthly_brand_id'], {
      name: 'idx_ret_monthly_brand_id'
    });
    await queryInterface.addIndex('review_extracted_texts', ['extraction_status'], {
      name: 'idx_ret_extraction_status'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('review_extracted_texts');
  }
};
