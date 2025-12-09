const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    token: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false
    },
    device_info: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    is_revoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'refresh_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['token'] },
      { fields: ['user_id'] },
      { fields: ['expires_at'] }
    ]
  });

  // Refresh Token 생성 헬퍼
  RefreshToken.generateToken = () => {
    return crypto.randomBytes(64).toString('hex');
  };

  // 만료 여부 확인
  RefreshToken.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  // 유효성 확인 (만료되지 않고, 폐기되지 않음)
  RefreshToken.prototype.isValid = function() {
    return !this.is_revoked && !this.isExpired();
  };

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return RefreshToken;
};
