const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Item = sequelize.define('Item', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'campaigns',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    // 품목 기본 정보
    product_name: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '제품명 (파이프 구분 가능, 예: "A | B")'
    },
    shipping_type: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '출고 유형 (파이프 구분 가능, 예: "실출고 | 미출고")'
    },
    keyword: {
      type: DataTypes.TEXT,
      comment: '키워드 (파이프 구분 가능)'
    },
    // 구매 목표
    total_purchase_count: {
      type: DataTypes.TEXT
    },
    daily_purchase_count: {
      type: DataTypes.TEXT,
      comment: '일 구매 건수 (예: "6/6", "1/3/4/2" - 슬래시 구분, 길이 제한 없음)'
    },
    // 상품 정보
    product_url: {
      type: DataTypes.TEXT
    },
    purchase_option: {
      type: DataTypes.TEXT,
      comment: '구매 옵션 (파이프 구분 가능)'
    },
    product_price: {
      type: DataTypes.TEXT,
      comment: '제품 가격 (파이프 구분 가능, 예: "27600 | 30000")'
    },
    // 출고 마감 시간 (파이프 구분 가능)
    shipping_deadline: {
      type: DataTypes.TEXT,
      comment: '출고 마감 시간 (파이프 구분 가능, 예: "오후1시 마감 | 오전 10시 마감")'
    },
    // 리뷰 가이드
    review_guide: {
      type: DataTypes.TEXT
    },
    courier_service_yn: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '택배대행 Y/N (파이프 구분 가능, 예: "Y | N")'
    },
    // 입금명 (카톡방명)
    deposit_name: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 판매 플랫폼 (쿠팡, 네이버, 11번가 등)
    platform: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '플랫폼 (파이프 구분 가능, 예: "쿠팡 | 네이버")'
    },
    // 제품 날짜 (사용자 입력)
    date: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 제품 표시 순번 (1, 2, 3...)
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // 기타
    notes: {
      type: DataTypes.TEXT
    },
    // 등록시간 (사용자 지정)
    registered_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    // 이미지 업로드 링크 토큰
    upload_link_token: {
      type: DataTypes.TEXT,
      unique: true,
      defaultValue: () => uuidv4()
    },
    // 상태
    status: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'active',
      comment: '상태 (active, completed, cancelled 등 자유 입력)'
    },
    // 매출 관련 필드
    sale_price_per_unit: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '판매 단가 (원/개)'
    },
    courier_price_per_unit: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '택배대행 단가 (원/개)'
    },
    // 지출 관련 필드 (Admin 입력)
    expense_product: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '지출 - 제품비 (원)'
    },
    expense_courier: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '지출 - 택배비 (원)'
    },
    expense_review: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '지출 - 리뷰비용 (원)'
    },
    expense_other: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '지출 - 기타비용 (원)'
    },
    expense_note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '지출 메모'
    }
  }, {
    tableName: 'items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['campaign_id'] },
      { fields: ['upload_link_token'] },
      { fields: ['status'] },
      { fields: ['deleted_at'] }
    ],
    hooks: {
      beforeCreate: (item) => {
        if (!item.upload_link_token) {
          item.upload_link_token = uuidv4();
        }
      }
    }
  });

  Item.associate = (models) => {
    // 품목이 속한 캠페인
    Item.belongsTo(models.Campaign, {
      foreignKey: 'campaign_id',
      as: 'campaign'
    });

    // 품목의 구매자들
    Item.hasMany(models.Buyer, {
      foreignKey: 'item_id',
      as: 'buyers'
    });

    // 품목의 이미지들
    Item.hasMany(models.Image, {
      foreignKey: 'item_id',
      as: 'images'
    });

    // 품목에 배정된 진행자들
    Item.hasMany(models.CampaignOperator, {
      foreignKey: 'item_id',
      as: 'operatorAssignments'
    });

    // 품목의 슬롯들
    Item.hasMany(models.ItemSlot, {
      foreignKey: 'item_id',
      as: 'slots'
    });
  };

  return Item;
};
