module.exports = (sequelize, DataTypes) => {
  const MonthlyBrand = sequelize.define('MonthlyBrand', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '연월브랜드명 (예: 2512어댑트)'
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
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      comment: '생성한 영업사 ID'
    },
    year_month: {
      type: DataTypes.STRING(4),
      allowNull: true,
      comment: '연월 (YYMM 형식, 예: 2512)'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'cancelled'),
      defaultValue: 'active'
    },
    is_hidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '숨김 여부'
    }
  }, {
    tableName: 'monthly_brands',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['brand_id'] },
      { fields: ['created_by'] },
      { fields: ['year_month'] },
      { fields: ['status'] },
      { fields: ['deleted_at'] }
    ]
  });

  MonthlyBrand.associate = (models) => {
    // 연월브랜드의 브랜드 사용자
    MonthlyBrand.belongsTo(models.User, {
      foreignKey: 'brand_id',
      as: 'brand'
    });

    // 연월브랜드를 생성한 영업사
    MonthlyBrand.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    // 연월브랜드의 캠페인들
    MonthlyBrand.hasMany(models.Campaign, {
      foreignKey: 'monthly_brand_id',
      as: 'campaigns'
    });
  };

  return MonthlyBrand;
};
