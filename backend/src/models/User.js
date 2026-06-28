const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      unique: true,
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.ENUM('admin', 'sales', 'operator', 'brand'),
      allowNull: false,
      validate: {
        isIn: [['admin', 'sales', 'operator', 'brand']]
      }
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    last_login: {
      type: DataTypes.DATE
    },
    assigned_sales_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: '담당 영업사 ID (브랜드 사용자 전용)'
    },
    initial_password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '초기 비밀번호 (Admin 확인용)'
    },
    last_activity: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '마지막 활동 시간 (Heartbeat 기준)'
    },
    serial: {
      type: DataTypes.STRING(10),
      unique: true,
      allowNull: true,
      comment: '브랜드사 일련번호 (BR0001 형식, 브랜드 전용 - 견적서 매칭키)'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['username'] },
      { fields: ['role'] },
      { fields: ['assigned_sales_id'] }
    ]
  });

  // 비밀번호 해싱 + 브랜드 일련번호 자동 생성 훅
  User.beforeCreate(async (user, options) => {
    if (user.password_hash) {
      user.password_hash = await bcrypt.hash(user.password_hash, 10);
    }
    // 브랜드 계정이면 일련번호(BR0001...) 자동 부여
    if (user.role === 'brand' && !user.serial) {
      const last = await User.findOne({
        where: { role: 'brand', serial: { [Op.ne]: null } },
        order: [['serial', 'DESC']],
        attributes: ['serial'],
        transaction: options && options.transaction
      });
      let lastNum = 0;
      if (last && last.serial) {
        const parsed = parseInt(String(last.serial).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed)) lastNum = parsed;
      }
      user.serial = 'BR' + String(lastNum + 1).padStart(4, '0');
    }
  });

  User.beforeUpdate(async (user) => {
    if (user.changed('password_hash')) {
      user.password_hash = await bcrypt.hash(user.password_hash, 10);
    }
  });

  // 비밀번호 검증 메서드
  User.prototype.comparePassword = async function(password) {
    return bcrypt.compare(password, this.password_hash);
  };

  // 민감한 정보 제외하고 반환
  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password_hash;
    return values;
  };

  User.associate = (models) => {
    // User가 생성한 캠페인들
    User.hasMany(models.Campaign, {
      foreignKey: 'created_by',
      as: 'campaigns'
    });

    // User가 진행자로 배정된 캠페인들
    User.belongsToMany(models.Campaign, {
      through: models.CampaignOperator,
      foreignKey: 'operator_id',
      otherKey: 'campaign_id',
      as: 'assignedCampaigns'
    });

    // User가 생성한 구매자들
    User.hasMany(models.Buyer, {
      foreignKey: 'created_by',
      as: 'buyers'
    });

    // 브랜드 사용자의 담당 영업사 (자기참조)
    User.belongsTo(models.User, {
      foreignKey: 'assigned_sales_id',
      as: 'assignedSales'
    });

    // 영업사가 담당하는 브랜드들 (자기참조 - 레거시)
    User.hasMany(models.User, {
      foreignKey: 'assigned_sales_id',
      as: 'assignedBrands'
    });

    // N:M 관계 - 영업사가 담당하는 브랜드들 (BrandSales 테이블 통해)
    User.belongsToMany(models.User, {
      through: models.BrandSales,
      foreignKey: 'sales_id',
      otherKey: 'brand_id',
      as: 'managedBrands'
    });

    // N:M 관계 - 브랜드를 담당하는 영업사들 (BrandSales 테이블 통해)
    User.belongsToMany(models.User, {
      through: models.BrandSales,
      foreignKey: 'brand_id',
      otherKey: 'sales_id',
      as: 'assignedSalesUsers'
    });
  };

  return User;
};
