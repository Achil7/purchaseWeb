module.exports = (sequelize, DataTypes) => {
  const Image = sequelize.define('Image', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    buyer_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'buyers',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'items',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    // 이미지 정보
    title: {
      type: DataTypes.STRING(200)
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    s3_key: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    s3_url: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    file_size: {
      type: DataTypes.INTEGER
    },
    mime_type: {
      type: DataTypes.STRING(50)
    },
    // 업로드 정보
    order_number: {
      type: DataTypes.STRING(100)
    },
    // 정규화된 계좌번호 (숫자만 추출)
    account_normalized: {
      type: DataTypes.STRING(50)
    },
    upload_token: {
      type: DataTypes.STRING(100)
    },
    uploaded_by_ip: {
      type: DataTypes.STRING(50)
    }
  }, {
    tableName: 'images',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['buyer_id'] },
      { fields: ['item_id'] },
      { fields: ['upload_token'] },
      { fields: ['account_normalized'] },
      { fields: ['deleted_at'] }
    ]
  });

  Image.associate = (models) => {
    // 이미지가 속한 구매자
    Image.belongsTo(models.Buyer, {
      foreignKey: 'buyer_id',
      as: 'buyer'
    });

    // 이미지가 속한 품목
    Image.belongsTo(models.Item, {
      foreignKey: 'item_id',
      as: 'item'
    });
  };

  return Image;
};
