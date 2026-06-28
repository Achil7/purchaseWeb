const { Sequelize } = require('sequelize');
const config = require('./database');

/**
 * 읽기전용(read-only) Sequelize 인스턴스
 * - Admin AI 챗이 생성한 SQL을 실행하는 전용 연결
 * - 별도 Postgres 역할(ai_readonly, SELECT 권한만)로 접속해 DB 변경을 원천 차단
 * - statement_timeout으로 폭주 쿼리 차단
 *
 * 기본은 메인 앱과 같은 host/port/name/ssl을 재사용하고 계정만 읽기전용으로 교체한다.
 * 단, AI 챗만 다른 DB(예: test 앱에서 prod DB)를 읽게 하려면 DB_READONLY_NAME/HOST/PORT로 override.
 */
const env = process.env.NODE_ENV || 'development';
const baseConfig = config[env];

const readonlyUser = process.env.DB_READONLY_USER;
const readonlyPassword = process.env.DB_READONLY_PASSWORD;

// 읽기전용 연결 대상 override (미설정 시 메인 앱과 동일 DB)
const readonlyDatabase = process.env.DB_READONLY_NAME || baseConfig.database;
const readonlyHost = process.env.DB_READONLY_HOST || baseConfig.host;
const readonlyPort = process.env.DB_READONLY_PORT || baseConfig.port;

// statement_timeout(ms) + production SSL 옵션 병합
const dialectOptions = {
  ...(baseConfig.dialectOptions || {}),
  statement_timeout: 10000, // 10초 초과 쿼리 차단
};

const readonlySequelize = new Sequelize(
  readonlyDatabase,
  readonlyUser,
  readonlyPassword,
  {
    host: readonlyHost,
    port: readonlyPort,
    dialect: baseConfig.dialect,
    logging: false,
    pool: { max: 3, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions,
  }
);

module.exports = { readonlySequelize };
