/**
 * RankingCollectionJob
 * 랭킹 수집 작업 로그 + 진행 상태 + rate limit 카운트
 */
module.exports = (sequelize, DataTypes) => {
  const RankingCollectionJob = sequelize.define('RankingCollectionJob', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'pending / running / completed / failed'
    },
    triggered_by: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'scheduler / admin / brand'
    },
    triggered_user_id: { type: DataTypes.INTEGER, allowNull: true },
    total_categories: { type: DataTypes.INTEGER, defaultValue: 0 },
    success_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    fail_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    inserted_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
    current_idx: { type: DataTypes.INTEGER, defaultValue: 0 },
    current_category: { type: DataTypes.STRING(100), allowNull: true },
    error_text: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    retry_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    duration_ms: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    tableName: 'ranking_collection_jobs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return RankingCollectionJob;
};
