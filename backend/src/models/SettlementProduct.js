module.exports = (sequelize, DataTypes) => {
  const SettlementProduct = sequelize.define('SettlementProduct', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    settlement_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '정산 FK'
    },
    product_name: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '제품명'
    },
    product_qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '제품 수량'
    },
    product_unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: '제품비 단가'
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: '정렬 순서'
    }
  }, {
    tableName: 'settlement_products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  SettlementProduct.associate = (models) => {
    SettlementProduct.belongsTo(models.Settlement, {
      foreignKey: 'settlement_id',
      as: 'settlement'
    });
  };

  return SettlementProduct;
};
