const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dbPort = parseInt(process.env.DB_PORT, 10) || 5432;

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: dbPort,
    dialect: 'postgres',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME + '_test',
    host: process.env.DB_HOST,
    port: dbPort,
    dialect: 'postgres',
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: dbPort,
    dialect: 'postgres',
    benchmark: true,
    logging: (sql, timing) => {
      if (timing > 100) {
        console.warn(`[SLOW QUERY] ${timing}ms - ${sql.substring(0, 200)}`);
      }
    },
    pool: {
      max: 50,
      min: 10,
      acquire: 30000,
      idle: 30000
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};
