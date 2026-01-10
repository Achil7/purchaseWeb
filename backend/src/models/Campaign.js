module.exports = (sequelize, DataTypes) => {
  const Campaign = sequelize.define('Campaign', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    registered_at: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: '캠페인 등록 날짜'
    },
    description: {
      type: DataTypes.TEXT
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'RESTRICT'
    },
    brand_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    monthly_brand_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'monthly_brands',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: '연월브랜드 ID'
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'cancelled'),
      defaultValue: 'active'
    },
    start_date: {
      type: DataTypes.DATEONLY
    },
    end_date: {
      type: DataTypes.DATEONLY
    },
    is_hidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '숨김 여부'
    }
  }, {
    tableName: 'campaigns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['created_by'] },
      { fields: ['brand_id'] },
      { fields: ['status'] },
      { fields: ['registered_at'] }
    ]
  });

  Campaign.associate = (models) => {
    // 캠페인을 생성한 영업사
    Campaign.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    // 캠페인의 브랜드사
    Campaign.belongsTo(models.User, {
      foreignKey: 'brand_id',
      as: 'brand'
    });

    // 캠페인의 연월브랜드
    Campaign.belongsTo(models.MonthlyBrand, {
      foreignKey: 'monthly_brand_id',
      as: 'monthlyBrand'
    });

    // 캠페인의 품목들
    Campaign.hasMany(models.Item, {
      foreignKey: 'campaign_id',
      as: 'items'
    });

    // 캠페인에 배정된 진행자들
    Campaign.belongsToMany(models.User, {
      through: models.CampaignOperator,
      foreignKey: 'campaign_id',
      otherKey: 'operator_id',
      as: 'operators'
    });

    // 캠페인-진행자 매핑
    Campaign.hasMany(models.CampaignOperator, {
      foreignKey: 'campaign_id',
      as: 'operatorAssignments'
    });
  };

  return Campaign;
};
