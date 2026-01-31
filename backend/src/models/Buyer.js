module.exports = (sequelize, DataTypes) => {
  const Buyer = sequelize.define('Buyer', {
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
    // 구매자 정보
    order_number: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    buyer_name: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    recipient_name: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    user_id: {
      type: DataTypes.TEXT
    },
    contact: {
      type: DataTypes.TEXT
    },
    address: {
      type: DataTypes.TEXT
    },
    account_info: {
      type: DataTypes.TEXT
    },
    // 정규화된 계좌번호 (숫자만 추출)
    account_normalized: {
      type: DataTypes.TEXT
    },
    // 임시 구매자 여부 (선 업로드 케이스)
    is_temporary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    amount: {
      type: DataTypes.TEXT,
      defaultValue: '0'
    },
    // 입금 확인
    payment_status: {
      type: DataTypes.ENUM('pending', 'completed'),
      defaultValue: 'pending'
    },
    payment_confirmed_by: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    payment_confirmed_at: {
      type: DataTypes.DATE
    },
    // 송장번호 (Sales, Admin이 입력)
    tracking_number: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 택배사
    courier_company: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '택배사'
    },
    // 배송지연 여부
    shipping_delayed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // 비고
    notes: {
      type: DataTypes.TEXT
    },
    // 입금명 (구매자별로 다를 수 있음)
    deposit_name: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 입금 예정일 (다음 영업일 기준)
    expected_payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    // 리뷰 이미지 제출 시간
    review_submitted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // 날짜 (구매자별 독립적인 날짜)
    date: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 생성 정보
    created_by: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    }
  }, {
    tableName: 'buyers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['item_id'] },
      { fields: ['order_number'] },
      { fields: ['payment_status'] },
      { fields: ['account_normalized'] },
      { fields: ['is_temporary'] },
      { fields: ['shipping_delayed'] },
      { fields: ['deleted_at'] },
      { fields: ['date'] }
    ]
  });

  Buyer.associate = (models) => {
    // 구매자가 속한 품목
    Buyer.belongsTo(models.Item, {
      foreignKey: 'item_id',
      as: 'item'
    });

    // 구매자를 생성한 진행자
    Buyer.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    // 입금을 확인한 관리자
    Buyer.belongsTo(models.User, {
      foreignKey: 'payment_confirmed_by',
      as: 'paymentConfirmer'
    });

    // 구매자의 리뷰 이미지들
    Buyer.hasMany(models.Image, {
      foreignKey: 'buyer_id',
      as: 'images'
    });

    // 구매자가 연결된 슬롯 (ItemSlot.buyer_id → Buyer.id)
    Buyer.hasOne(models.ItemSlot, {
      foreignKey: 'buyer_id',
      as: 'slot'
    });
  };

  return Buyer;
};
