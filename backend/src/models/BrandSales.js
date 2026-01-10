module.exports = (sequelize, DataTypes) => {
  const BrandSales = sequelize.define('BrandSales', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: '브랜드 사용자 ID'
    },
    sales_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: '영업사 사용자 ID'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: '할당한 사용자 ID (Admin 또는 영업사 본인)'
    }
  }, {
    tableName: 'brand_sales',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // updated_at 불필요
    indexes: [
      { fields: ['brand_id'], name: 'idx_brand_sales_brand' },
      { fields: ['sales_id'], name: 'idx_brand_sales_sales' },
      {
        unique: true,
        fields: ['brand_id', 'sales_id'],
        name: 'unique_brand_sales'
      }
    ]
  });

  BrandSales.associate = (models) => {
    // 브랜드 사용자
    BrandSales.belongsTo(models.User, {
      foreignKey: 'brand_id',
      as: 'brand'
    });

    // 영업사 사용자
    BrandSales.belongsTo(models.User, {
      foreignKey: 'sales_id',
      as: 'salesUser'
    });

    // 할당한 사용자
    BrandSales.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });
  };

  return BrandSales;
};
