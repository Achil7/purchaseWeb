const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

async function run() {
  try {
    // 어댑트01-30 캠페인에 속한 모든 구매자의 date를 26-01-30으로 강제 설정
    const [results, metadata] = await sequelize.query(`
      UPDATE buyers b
      SET date = '26-01-30'
      FROM item_slots s
      JOIN items i ON s.item_id = i.id
      JOIN campaigns c ON i.campaign_id = c.id
      WHERE s.buyer_id = b.id
        AND c.name LIKE '%어댑트01-30%'
        AND b.deleted_at IS NULL
    `);

    console.log('UPDATE 결과:', metadata.rowCount || metadata);

    // 결과 확인
    const [check] = await sequelize.query(`
      SELECT mb.name as monthly_brand, c.name as campaign, b.date, COUNT(*) as cnt
      FROM buyers b
      JOIN item_slots s ON s.buyer_id = b.id
      JOIN items i ON s.item_id = i.id
      JOIN campaigns c ON i.campaign_id = c.id
      LEFT JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
      WHERE c.name LIKE '%어댑트%'
        AND b.deleted_at IS NULL
      GROUP BY mb.name, c.name, b.date
      ORDER BY mb.name, c.name, b.date
    `);

    console.log('\n업데이트 후 분포:');
    console.table(check);

  } catch (err) {
    console.error('에러:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
