'use strict';

const bcrypt = require('bcryptjs');
const mockData = require('./mock-data');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. 사용자 추가 (비밀번호 해싱)
    const usersWithHashedPassword = await Promise.all(
      mockData.users.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10)
      }))
    );
    await queryInterface.bulkInsert('users', usersWithHashedPassword);

    // 2. 캠페인 추가
    await queryInterface.bulkInsert('campaigns', mockData.campaigns);

    // 3. 품목 추가
    await queryInterface.bulkInsert('items', mockData.items);

    // 4. 진행자 배정
    await queryInterface.bulkInsert('campaign_operators', mockData.campaign_operators);

    // 5. 구매자 추가
    await queryInterface.bulkInsert('buyers', mockData.buyers);

    console.log('✅ Mock test data seeded successfully!');
  },

  down: async (queryInterface, Sequelize) => {
    // 역순으로 삭제
    await queryInterface.bulkDelete('buyers', null, {});
    await queryInterface.bulkDelete('campaign_operators', null, {});
    await queryInterface.bulkDelete('items', null, {});
    await queryInterface.bulkDelete('campaigns', null, {});
    await queryInterface.bulkDelete('users', { username: { [Sequelize.Op.ne]: 'admin' } }, {});

    console.log('✅ Mock test data removed!');
  }
};
