'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    // TODO: Change this password before deployment!
    const password = await bcrypt.hash('your_secure_password_here', 10);

    const masterUsers = [
      {
        username: 'admin',
        password_hash: password,
        name: '마스터 관리자',
        email: 'admin@example.com',
        role: 'admin',
        phone: '010-0000-0000',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'sales',
        password_hash: password,
        name: '마스터 영업사',
        email: 'sales@example.com',
        role: 'sales',
        phone: '010-0000-0001',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'operator',
        password_hash: password,
        name: '마스터 진행자',
        email: 'operator@example.com',
        role: 'operator',
        phone: '010-0000-0002',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'brand',
        password_hash: password,
        name: '마스터 브랜드사',
        email: 'brand@example.com',
        role: 'brand',
        phone: '010-0000-0003',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // 기존 마스터 계정이 있으면 삭제 후 새로 생성
    for (const user of masterUsers) {
      await queryInterface.bulkDelete('users', { username: user.username });
    }

    await queryInterface.bulkInsert('users', masterUsers);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
      username: ['admin', 'sales', 'operator', 'brand']
    });
  }
};
