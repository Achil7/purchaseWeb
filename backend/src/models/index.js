const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    benchmark: dbConfig.benchmark || false,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions || {}
  }
);

const db = {};

// 모델 임포트
db.User = require('./User')(sequelize, Sequelize.DataTypes);
db.MonthlyBrand = require('./MonthlyBrand')(sequelize, Sequelize.DataTypes);
db.Campaign = require('./Campaign')(sequelize, Sequelize.DataTypes);
db.Item = require('./Item')(sequelize, Sequelize.DataTypes);
db.CampaignOperator = require('./CampaignOperator')(sequelize, Sequelize.DataTypes);
db.Buyer = require('./Buyer')(sequelize, Sequelize.DataTypes);
db.Image = require('./Image')(sequelize, Sequelize.DataTypes);
db.RefreshToken = require('./RefreshToken')(sequelize, Sequelize.DataTypes);
db.Notification = require('./Notification')(sequelize, Sequelize.DataTypes);
db.Setting = require('./Setting')(sequelize, Sequelize.DataTypes);
db.UserActivity = require('./UserActivity')(sequelize, Sequelize.DataTypes);
db.UserMemo = require('./UserMemo')(sequelize, Sequelize.DataTypes);
db.ItemSlot = require('./ItemSlot')(sequelize, Sequelize.DataTypes);
db.SheetMemo = require('./SheetMemo')(sequelize, Sequelize.DataTypes);
db.BrandSales = require('./BrandSales')(sequelize, Sequelize.DataTypes);
db.ReviewExtractedText = require('./ReviewExtractedText')(sequelize, Sequelize.DataTypes);
db.PlatformRanking = require('./PlatformRanking')(sequelize, Sequelize.DataTypes);
db.RankingCollectionJob = require('./RankingCollectionJob')(sequelize, Sequelize.DataTypes);
db.Blogger = require('./Blogger')(sequelize, Sequelize.DataTypes);
db.BloggerRequest = require('./BloggerRequest')(sequelize, Sequelize.DataTypes);
db.BloggerRequestItem = require('./BloggerRequestItem')(sequelize, Sequelize.DataTypes);

// 모델 관계 설정
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
