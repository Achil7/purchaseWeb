module.exports = (sequelize, DataTypes) => {
  const Settlement = sequelize.define('Settlement', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    settlement_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '정산ID (예: 260106조이쿠팡)'
    },
    company_name: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '업체명'
    },
    month: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '정산 월 (예: 2026-01)'
    },
    rev_processing_fee: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: '매출 진행비 단가'
    },
    rev_processing_qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '매출 진행 수량'
    },
    rev_delivery_fee: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: '매출 택배대행 단가'
    },
    rev_delivery_qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '매출 택배 수량'
    },
    exp_processing_fee: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: '지출 진행비(실비) 단가'
    },
    memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '메모'
    }
  }, {
    tableName: 'settlements',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Settlement.associate = (models) => {
    Settlement.hasMany(models.SettlementProduct, {
      foreignKey: 'settlement_id',
      as: 'products',
      onDelete: 'CASCADE'
    });
  };

  return Settlement;
};
