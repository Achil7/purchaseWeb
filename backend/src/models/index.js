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
db.Estimate = require('./Estimate')(sequelize, Sequelize.DataTypes);
db.Settlement = require('./Settlement')(sequelize, Sequelize.DataTypes);
db.SettlementProduct = require('./SettlementProduct')(sequelize, Sequelize.DataTypes);
db.MarginSetting = require('./MarginSetting')(sequelize, Sequelize.DataTypes);

// 모델 관계 설정
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
