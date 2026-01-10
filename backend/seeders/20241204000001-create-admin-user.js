'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const password = 'admin123!@#'; // 첫 로그인 후 반드시 변경
    const hashedPassword = await bcrypt.hash(password, 10);

    await queryInterface.bulkInsert('users', [
      {
        username: 'admin',
        password_hash: hashedPassword,
        name: '시스템 관리자',
        email: 'admin@campmanager.com',
        role: 'admin',
        phone: '010-0000-0000',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    console.log('✅ Admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin123!@#');
    console.log('   ⚠️  Please change this password after first login!');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
      username: 'admin'
    }, {});
  }
};
