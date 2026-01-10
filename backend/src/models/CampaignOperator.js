module.exports = (sequelize, DataTypes) => {
  const CampaignOperator = sequelize.define('CampaignOperator', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'campaigns',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    item_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'items',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    operator_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    assigned_by: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    // 품목 내 일자 그룹 번호 (day_group 단위 배정 지원)
    day_group: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '품목 내 일자 그룹 번호 (null이면 전체 품목 배정, 숫자면 해당 그룹만 배정)'
    }
  }, {
    tableName: 'campaign_operators',
    timestamps: false,
    indexes: [
      { fields: ['campaign_id'] },
      { fields: ['item_id'] },
      { fields: ['operator_id'] },
      { fields: ['day_group'] },
      {
        unique: true,
        fields: ['campaign_id', 'item_id', 'day_group', 'operator_id'],
        name: 'unique_campaign_operator_daygroup'
      }
    ]
  });

  CampaignOperator.associate = (models) => {
    CampaignOperator.belongsTo(models.Campaign, {
      foreignKey: 'campaign_id',
      as: 'campaign'
    });

    CampaignOperator.belongsTo(models.Item, {
      foreignKey: 'item_id',
      as: 'item'
    });

    CampaignOperator.belongsTo(models.User, {
      foreignKey: 'operator_id',
      as: 'operator'
    });

    CampaignOperator.belongsTo(models.User, {
      foreignKey: 'assigned_by',
      as: 'assigner'
    });
  };

  return CampaignOperator;
};
