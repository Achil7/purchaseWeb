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
      type: DataTypes.STRING(20),
      allowNull: true
    },
    // 품목 기본 정보 (복사됨)
    product_name: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    purchase_option: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    keyword: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    product_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'cancelled'),
      defaultValue: 'active'
    },
    // 예상구매자 (진행자 입력)
    expected_buyer: {
      type: DataTypes.STRING(100),
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
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // 리뷰비용 (진행자 입력)
    review_cost: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'item_slots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['item_id'] },
      { fields: ['buyer_id'] },
      { fields: ['status'] },
      { fields: ['day_group'] },
      { fields: ['upload_link_token'] },
      { unique: true, fields: ['item_id', 'slot_number'] }
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
