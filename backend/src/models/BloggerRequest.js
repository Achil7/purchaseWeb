module.exports = (sequelize, DataTypes) => {
  const BloggerRequest = sequelize.define('BloggerRequest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      comment: '요청한 브랜드사 사용자 ID'
    },
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'campaigns', key: 'id' },
      onDelete: 'SET NULL',
      comment: '연관 캠페인 (선택)'
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'requested',
      comment: 'requested / reviewing / in_progress / completed / cancelled'
    },
    product_provision: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'sponsored(협찬) / self_purchase(내돈내산)'
    },
    guide_text: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '브랜드 가이드'
    },
    brand_memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '브랜드 요청 메모'
    },
    admin_memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'kwad CS 메모'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL'
    }
  }, {
    tableName: 'blogger_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['brand_id'], name: 'idx_blogger_requests_brand' },
      { fields: ['status'], name: 'idx_blogger_requests_status' },
      { fields: ['deleted_at'], name: 'idx_blogger_requests_deleted_at' }
    ]
  });

  BloggerRequest.associate = (models) => {
    BloggerRequest.belongsTo(models.User, { foreignKey: 'brand_id', as: 'brand' });
    BloggerRequest.belongsTo(models.Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
    BloggerRequest.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    BloggerRequest.hasMany(models.BloggerRequestItem, { foreignKey: 'request_id', as: 'items' });
  };

  return BloggerRequest;
};
