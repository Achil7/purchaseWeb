module.exports = (sequelize, DataTypes) => {
  const Campaign = sequelize.define('Campaign', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
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
    status: {
      type: DataTypes.ENUM('active', 'completed', 'cancelled'),
      defaultValue: 'active'
    },
    start_date: {
      type: DataTypes.DATEONLY
    },
    end_date: {
      type: DataTypes.DATEONLY
    }
  }, {
    tableName: 'campaigns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['created_by'] },
      { fields: ['brand_id'] },
      { fields: ['status'] }
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

    // 캠페인의 품목들
    Campaign.hasMany(models.Item, {
      foreignKey: 'campaign_id',
      as: 'items'
    });

    // 캠페인에 배정된 진행자들
    Campaign.belongsToMany(models.User, {
      through: models.CampaignOperator,
      foreignKey: 'campaign_id',
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
