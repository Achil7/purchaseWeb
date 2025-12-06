'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const password = await bcrypt.hash('rkddntkfkd94!', 10);

    const masterUsers = [
      {
        username: 'achiladmin',
        password_hash: password,
        name: '마스터 관리자',
        email: 'admin@kwad.co.kr',
        role: 'admin',
        phone: '010-0000-0000',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'achilsales',
        password_hash: password,
        name: '마스터 영업사',
        email: 'sales@kwad.co.kr',
        role: 'sales',
        phone: '010-0000-0001',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'achiloperator',
        password_hash: password,
        name: '마스터 진행자',
        email: 'operator@kwad.co.kr',
        role: 'operator',
        phone: '010-0000-0002',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'achilbrand',
        password_hash: password,
        name: '마스터 브랜드사',
        email: 'brand@kwad.co.kr',
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
      username: ['achiladmin', 'achilsales', 'achiloperator', 'achilbrand']
    });
  }
};
