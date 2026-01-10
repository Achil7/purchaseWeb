module.exports = (sequelize, DataTypes) => {
  const SheetMemo = sequelize.define('SheetMemo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // 캠페인 ID (어떤 캠페인의 시트인지)
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'campaigns',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    // 시트 타입 (operator, sales)
    sheet_type: {
      type: DataTypes.ENUM('operator', 'sales'),
      allowNull: false
    },
    // 사용자 ID (누가 작성했는지)
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    // 행 인덱스 (데이터 행 이후의 추가 행)
    row_index: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // 열 인덱스
    col_index: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // 메모 내용
    value: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'sheet_memos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['campaign_id'] },
      { fields: ['user_id'] },
      { fields: ['sheet_type'] },
      // 캠페인+타입+사용자+행+열 조합은 유니크
      { unique: true, fields: ['campaign_id', 'sheet_type', 'user_id', 'row_index', 'col_index'] }
    ]
  });

  SheetMemo.associate = (models) => {
    SheetMemo.belongsTo(models.Campaign, {
      foreignKey: 'campaign_id',
      as: 'campaign'
    });
    SheetMemo.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return SheetMemo;
};
