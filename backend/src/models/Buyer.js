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
      type: DataTypes.STRING(50),
      allowNull: false
    },
    buyer_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    recipient_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    user_id: {
      type: DataTypes.STRING(100)
    },
    contact: {
      type: DataTypes.STRING(50)
    },
    address: {
      type: DataTypes.TEXT
    },
    account_info: {
      type: DataTypes.STRING(200)
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2)
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
    // 비고
    notes: {
      type: DataTypes.TEXT
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
    indexes: [
      { fields: ['item_id'] },
      { fields: ['order_number'] },
      { fields: ['payment_status'] }
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
  };

  return Buyer;
};
