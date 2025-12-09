const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Item = sequelize.define('Item', {
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
    // 품목 기본 정보
    product_name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    shipping_type: {
      type: DataTypes.ENUM('실출고', '미출고')
    },
    keyword: {
      type: DataTypes.STRING(200)
    },
    // 구매 목표
    total_purchase_count: {
      type: DataTypes.INTEGER
    },
    daily_purchase_count: {
      type: DataTypes.INTEGER
    },
    // 상품 정보
    product_url: {
      type: DataTypes.TEXT
    },
    purchase_option: {
      type: DataTypes.STRING(100)
    },
    product_price: {
      type: DataTypes.DECIMAL(10, 2)
    },
    // 일정 (시간 문자열, 예: "18:00")
    shipping_deadline: {
      type: DataTypes.STRING(20)
    },
    // 리뷰 가이드
    review_guide: {
      type: DataTypes.TEXT
    },
    courier_service_yn: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // 기타
    notes: {
      type: DataTypes.TEXT
    },
    // 등록시간 (사용자 지정)
    registered_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    // 이미지 업로드 링크 토큰
    upload_link_token: {
      type: DataTypes.STRING(100),
      unique: true,
      defaultValue: () => uuidv4()
    },
    // 상태
    status: {
      type: DataTypes.ENUM('active', 'completed', 'cancelled'),
      defaultValue: 'active'
    }
  }, {
    tableName: 'items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['campaign_id'] },
      { fields: ['upload_link_token'] },
      { fields: ['status'] }
    ],
    hooks: {
      beforeCreate: (item) => {
        if (!item.upload_link_token) {
          item.upload_link_token = uuidv4();
        }
      }
    }
  });

  Item.associate = (models) => {
    // 품목이 속한 캠페인
    Item.belongsTo(models.Campaign, {
      foreignKey: 'campaign_id',
      as: 'campaign'
    });

    // 품목의 구매자들
    Item.hasMany(models.Buyer, {
      foreignKey: 'item_id',
      as: 'buyers'
    });

    // 품목의 이미지들
    Item.hasMany(models.Image, {
      foreignKey: 'item_id',
      as: 'images'
    });

    // 품목에 배정된 진행자들
    Item.hasMany(models.CampaignOperator, {
      foreignKey: 'item_id',
      as: 'operatorAssignments'
    });
  };

  return Item;
};
