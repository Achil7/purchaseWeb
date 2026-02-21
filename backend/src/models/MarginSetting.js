module.exports = (sequelize, DataTypes) => {
  const MarginSetting = sequelize.define('MarginSetting', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    key: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
      comment: '설정 키'
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '설정 값'
    }
  }, {
    tableName: 'margin_settings',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
  });

  return MarginSetting;
};
