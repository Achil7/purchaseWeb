/**
 * PlatformRanking
 * 올리브영 카테고리 BEST 100 순위 시계열 저장
 * - PC 로컬 워커가 INSERT
 * - 백엔드는 읽기 전용
 */
module.exports = (sequelize, DataTypes) => {
  const PlatformRanking = sequelize.define('PlatformRanking', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    category_id: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    category_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    product_name: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    brand_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    goods_no: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    product_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    original_price: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    sale_price: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    discount_rate: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    collected_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'platform_rankings',
    timestamps: false,
    indexes: [
      { fields: ['category_id', 'collected_at'] },
      { fields: ['goods_no'] },
      { fields: ['collected_at'] }
    ]
  });

  return PlatformRanking;
};
