const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const ItemSlot = sequelize.define('ItemSlot', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'items',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    slot_number: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // 날짜 (사용자 입력)
    date: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 품목 기본 정보 (day_group별 독립 - 일마감 시 복사됨)
    product_name: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    purchase_option: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    keyword: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    product_price: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    platform: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    shipping_type: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    total_purchase_count: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    daily_purchase_count: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    courier_service_yn: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 택배사명 (기본값: 롯데택배)
    courier_name: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '롯데택배'
    },
    product_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'active'
    },
    // 예상구매자 (진행자 입력)
    expected_buyer: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 구매자 연결 (FK)
    buyer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'buyers',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    // 일 구매건수 그룹 번호 (1, 2, 3...)
    day_group: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    // 그룹별 이미지 업로드 링크 토큰
    upload_link_token: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 리뷰비용 (진행자 입력)
    review_cost: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 구매자 테이블의 비고 컬럼 (제품 테이블의 notes와 별개)
    buyer_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 중단 상태 (Admin이 중단 처리한 day_group)
    is_suspended: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'item_slots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['item_id'] },
      { fields: ['buyer_id'] },
      { fields: ['status'] },
      { fields: ['day_group'] },
      { fields: ['upload_link_token'] },
      { fields: ['deleted_at'] },
      { fields: ['is_suspended'] },
      { unique: true, fields: ['item_id', 'day_group', 'slot_number'] }
    ]
  });

  ItemSlot.associate = (models) => {
    // 슬롯이 속한 품목
    ItemSlot.belongsTo(models.Item, {
      foreignKey: 'item_id',
      as: 'item'
    });

    // 슬롯에 연결된 구매자
    ItemSlot.belongsTo(models.Buyer, {
      foreignKey: 'buyer_id',
      as: 'buyer'
    });
  };

  return ItemSlot;
};
