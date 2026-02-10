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
    },
    // 재제출 관련 필드
    status: {
      type: DataTypes.TEXT,
      defaultValue: 'approved',
      allowNull: false,
      comment: '승인 상태 (pending: 대기, approved: 승인, rejected: 거절)'
    },
    resubmitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '재제출 시간'
    },
    previous_image_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'images',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: '재제출인 경우 이전 이미지 ID'
    },
    // 재제출 그룹 ID (같은 배치로 업로드된 재제출 이미지들을 그룹화)
    resubmission_group_id: {
      type: DataTypes.STRING(36),
      allowNull: true,
      comment: '재제출 그룹 ID (UUID) - 같은 구매자가 한번에 재제출한 이미지들은 동일한 그룹 ID를 가짐'
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
      { fields: ['deleted_at'] },
      { fields: ['status'] },
      { fields: ['previous_image_id'] },
      { fields: ['resubmission_group_id'] }
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

    // 이전 이미지 (재제출인 경우)
    Image.belongsTo(models.Image, {
      foreignKey: 'previous_image_id',
      as: 'previousImage'
    });

    // 재제출된 이미지들
    Image.hasMany(models.Image, {
      foreignKey: 'previous_image_id',
      as: 'resubmissions'
    });
  };

  return Image;
};
