/**
 * ReviewExtractedText
 * 구매자 리뷰샷 이미지에서 GPT-4o Vision으로 추출한 텍스트 저장
 * - buyer_id 기준 (1 구매자 = 1 행, 여러 이미지 합산)
 */
module.exports = (sequelize, DataTypes) => {
  const ReviewExtractedText = sequelize.define('ReviewExtractedText', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    buyer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: 'buyers', key: 'id' },
      onDelete: 'CASCADE'
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'items', key: 'id' },
      onDelete: 'CASCADE'
    },
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'campaigns', key: 'id' },
      onDelete: 'SET NULL'
    },
    monthly_brand_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'monthly_brands', key: 'id' },
      onDelete: 'SET NULL'
    },
    extracted_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    image_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    image_ids: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    extraction_status: {
      type: DataTypes.TEXT,
      defaultValue: 'pending',
      allowNull: false,
      comment: 'pending / completed / not_review / failed / skipped'
    },
    tokens_used_input: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    tokens_used_output: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    cost_usd: {
      type: DataTypes.DECIMAL(10, 6),
      defaultValue: 0
    },
    model_used: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    detail_used: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    extraction_error: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    last_image_updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    extracted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'review_extracted_texts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['buyer_id'], unique: true },
      { fields: ['item_id'] },
      { fields: ['campaign_id'] },
      { fields: ['monthly_brand_id'] },
      { fields: ['extraction_status'] }
    ]
  });

  ReviewExtractedText.associate = (models) => {
    ReviewExtractedText.belongsTo(models.Buyer, {
      foreignKey: 'buyer_id',
      as: 'buyer'
    });
    ReviewExtractedText.belongsTo(models.Item, {
      foreignKey: 'item_id',
      as: 'item'
    });
    ReviewExtractedText.belongsTo(models.Campaign, {
      foreignKey: 'campaign_id',
      as: 'campaign'
    });
    ReviewExtractedText.belongsTo(models.MonthlyBrand, {
      foreignKey: 'monthly_brand_id',
      as: 'monthlyBrand'
    });
  };

  return ReviewExtractedText;
};
