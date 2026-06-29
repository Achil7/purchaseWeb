module.exports = (sequelize, DataTypes) => {
  const BloggerRequestItem = sequelize.define('BloggerRequestItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    request_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'blogger_requests', key: 'id' },
      onDelete: 'CASCADE'
    },
    blogger_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'bloggers', key: 'id' },
      onDelete: 'CASCADE'
    },
    participation_status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'pending',
      comment: 'pending / accepted / declined'
    },
    product_provision: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '항목별 제품 제공 방식 (없으면 request 상속)'
    },
    unit_price: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '협의 단가 (TEXT)'
    },
    shipping_address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '협찬 배송 주소'
    },
    submission_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '작성 글 링크'
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '작성 링크 제출 일자'
    },
    submit_token: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '공개 제출 링크용 토큰'
    },
    admin_memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '항목별 CS 메모'
    }
  }, {
    tableName: 'blogger_request_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['request_id'], name: 'idx_bri_request' },
      { fields: ['blogger_id'], name: 'idx_bri_blogger' },
      { fields: ['submit_token'], name: 'idx_bri_submit_token' },
      { fields: ['deleted_at'], name: 'idx_bri_deleted_at' },
      { unique: true, fields: ['request_id', 'blogger_id'], name: 'unique_bri_request_blogger' }
    ]
  });

  BloggerRequestItem.associate = (models) => {
    BloggerRequestItem.belongsTo(models.BloggerRequest, { foreignKey: 'request_id', as: 'request' });
    BloggerRequestItem.belongsTo(models.Blogger, { foreignKey: 'blogger_id', as: 'blogger' });
  };

  return BloggerRequestItem;
};
