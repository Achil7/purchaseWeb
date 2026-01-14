const { sequelize } = require('./src/models');

async function fixColumns() {
  try {
    console.log('=== Fixing all column types to TEXT ===\n');

    // ============ items 테이블 ============
    console.log('1. Fixing items table...');

    await sequelize.query(`
      ALTER TABLE items
      ALTER COLUMN courier_service_yn TYPE TEXT
      USING CASE WHEN courier_service_yn = true THEN 'Y' WHEN courier_service_yn = false THEN 'N' ELSE NULL END
    `).catch(e => console.log('  - courier_service_yn:', e.message.split('\n')[0]));

    await sequelize.query(`ALTER TABLE items ALTER COLUMN deposit_name TYPE TEXT`)
      .catch(e => console.log('  - deposit_name:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE items ALTER COLUMN date TYPE TEXT`)
      .catch(e => console.log('  - date:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE items ALTER COLUMN upload_link_token TYPE TEXT`)
      .catch(e => console.log('  - upload_link_token:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE items ALTER COLUMN status TYPE TEXT`)
      .catch(e => console.log('  - status:', e.message.split('\n')[0]));

    // ============ item_slots 테이블 ============
    console.log('2. Fixing item_slots table...');

    await sequelize.query(`ALTER TABLE item_slots ALTER COLUMN product_name TYPE TEXT`)
      .catch(e => console.log('  - product_name:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE item_slots ALTER COLUMN purchase_option TYPE TEXT`)
      .catch(e => console.log('  - purchase_option:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE item_slots ALTER COLUMN keyword TYPE TEXT`)
      .catch(e => console.log('  - keyword:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE item_slots ALTER COLUMN product_price TYPE TEXT`)
      .catch(e => console.log('  - product_price:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE item_slots ALTER COLUMN date TYPE TEXT`)
      .catch(e => console.log('  - date:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE item_slots ALTER COLUMN expected_buyer TYPE TEXT`)
      .catch(e => console.log('  - expected_buyer:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE item_slots ALTER COLUMN upload_link_token TYPE TEXT`)
      .catch(e => console.log('  - upload_link_token:', e.message.split('\n')[0]));

    // status ENUM 제거
    await sequelize.query(`ALTER TABLE item_slots DROP CONSTRAINT IF EXISTS "item_slots_status_check"`)
      .catch(e => {});
    await sequelize.query(`ALTER TABLE item_slots ALTER COLUMN status TYPE TEXT`)
      .catch(e => console.log('  - status:', e.message.split('\n')[0]));

    // ============ campaigns 테이블 ============
    console.log('3. Fixing campaigns table...');

    await sequelize.query(`ALTER TABLE campaigns ALTER COLUMN name TYPE TEXT`)
      .catch(e => console.log('  - name:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS "campaigns_status_check"`)
      .catch(e => {});
    await sequelize.query(`ALTER TABLE campaigns ALTER COLUMN status TYPE TEXT`)
      .catch(e => console.log('  - status:', e.message.split('\n')[0]));

    // ============ monthly_brands 테이블 ============
    console.log('4. Fixing monthly_brands table...');

    await sequelize.query(`ALTER TABLE monthly_brands ALTER COLUMN name TYPE TEXT`)
      .catch(e => console.log('  - name:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE monthly_brands ALTER COLUMN year_month TYPE TEXT`)
      .catch(e => console.log('  - year_month:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE monthly_brands DROP CONSTRAINT IF EXISTS "monthly_brands_status_check"`)
      .catch(e => {});
    await sequelize.query(`ALTER TABLE monthly_brands ALTER COLUMN status TYPE TEXT`)
      .catch(e => console.log('  - status:', e.message.split('\n')[0]));

    // ============ buyers 테이블 ============
    console.log('5. Fixing buyers table...');

    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN order_number TYPE TEXT`)
      .catch(e => console.log('  - order_number:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN buyer_name TYPE TEXT`)
      .catch(e => console.log('  - buyer_name:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN recipient_name TYPE TEXT`)
      .catch(e => console.log('  - recipient_name:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN user_id TYPE TEXT`)
      .catch(e => console.log('  - user_id:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN phone_number TYPE TEXT`)
      .catch(e => console.log('  - phone_number:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN address TYPE TEXT`)
      .catch(e => console.log('  - address:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN bank_account TYPE TEXT`)
      .catch(e => console.log('  - bank_account:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN tracking_number TYPE TEXT`)
      .catch(e => console.log('  - tracking_number:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN account_normalized TYPE TEXT`)
      .catch(e => console.log('  - account_normalized:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN courier_company TYPE TEXT`)
      .catch(e => console.log('  - courier_company:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE buyers DROP CONSTRAINT IF EXISTS "buyers_review_status_check"`)
      .catch(e => {});
    await sequelize.query(`ALTER TABLE buyers ALTER COLUMN review_status TYPE TEXT`)
      .catch(e => console.log('  - review_status:', e.message.split('\n')[0]));

    // ============ notifications 테이블 ============
    console.log('6. Fixing notifications table...');

    await sequelize.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS "notifications_type_check"`)
      .catch(e => {});
    await sequelize.query(`ALTER TABLE notifications ALTER COLUMN type TYPE TEXT`)
      .catch(e => console.log('  - type:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE notifications ALTER COLUMN title TYPE TEXT`)
      .catch(e => console.log('  - title:', e.message.split('\n')[0]));
    await sequelize.query(`ALTER TABLE notifications ALTER COLUMN related_type TYPE TEXT`)
      .catch(e => console.log('  - related_type:', e.message.split('\n')[0]));

    // ============ users 테이블 ============
    console.log('7. Fixing users table...');

    await sequelize.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "users_role_check"`)
      .catch(e => {});
    await sequelize.query(`ALTER TABLE users ALTER COLUMN role TYPE TEXT`)
      .catch(e => console.log('  - role:', e.message.split('\n')[0]));

    // ============ sheet_memos 테이블 ============
    console.log('8. Fixing sheet_memos table...');

    await sequelize.query(`ALTER TABLE sheet_memos DROP CONSTRAINT IF EXISTS "sheet_memos_type_check"`)
      .catch(e => {});
    await sequelize.query(`ALTER TABLE sheet_memos ALTER COLUMN type TYPE TEXT`)
      .catch(e => console.log('  - type:', e.message.split('\n')[0]));

    // ============ user_activities 테이블 ============
    console.log('9. Fixing user_activities table...');

    await sequelize.query(`ALTER TABLE user_activities DROP CONSTRAINT IF EXISTS "user_activities_action_check"`)
      .catch(e => {});
    await sequelize.query(`ALTER TABLE user_activities ALTER COLUMN action TYPE TEXT`)
      .catch(e => console.log('  - action:', e.message.split('\n')[0]));

    console.log('\n=== Done - all columns fixed ===');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
}

fixColumns();
