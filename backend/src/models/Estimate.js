module.exports = (sequelize, DataTypes) => {
  const Estimate = sequelize.define('Estimate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // 파일 정보
    file_name: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '업로드된 파일명'
    },
    // 회사 정보
    company_name: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '고객사(브랜드) 이름'
    },
    company_contact: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '고객사 담당자'
    },
    company_tel: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '고객사 전화번호'
    },
    company_email: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '고객사 이메일'
    },
    // 대행사 정보
    agency_name: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '대행사 이름'
    },
    agency_representative: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '대행사 대표자명'
    },
    agency_tel: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '대행사 전화번호'
    },
    agency_email: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '대행사 이메일'
    },
    // 카테고리별 금액
    category_review: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: '구매평 서비스 총액'
    },
    category_product: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: '제품비 총액'
    },
    category_delivery: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: '택배대행 총액'
    },
    category_other: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: '기타작업 총액'
    },
    // 합계
    supply_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: '공급가 총액'
    },
    vat_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: '부가세'
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: '합계금액'
    },
    // 품목 상세 (JSON)
    items_json: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '품목 상세 데이터 (JSON 문자열)'
    },
    // 견적서 날짜
    estimate_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: '견적서 작성일자'
    },
    // 업로드한 사용자
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '업로드한 사용자 ID'
    },
    // 메모
    memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '메모'
    }
  }, {
    tableName: 'estimates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Estimate.associate = (models) => {
    Estimate.belongsTo(models.User, {
      foreignKey: 'uploaded_by',
      as: 'uploader'
    });
  };

  return Estimate;
};
