module.exports = (sequelize, DataTypes) => {
  const Blogger = sequelize.define('Blogger', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    activity_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '활동명'
    },
    blog_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '블로그 주소'
    },
    daily_visitors: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '평균 1일 방문자 수 (TEXT 정책 - 집계 시 캐스팅)'
    },
    main_content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '주요 콘텐츠'
    },
    memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'admin 내부 메모 (브랜드 비노출)'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: '브랜드 노출 여부'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: '등록한 admin 사용자 ID'
    }
  }, {
    tableName: 'bloggers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['is_active'], name: 'idx_bloggers_is_active' },
      { fields: ['deleted_at'], name: 'idx_bloggers_deleted_at' }
    ]
  });

  Blogger.associate = (models) => {
    // 등록한 admin 사용자
    Blogger.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });
  };

  return Blogger;
};
