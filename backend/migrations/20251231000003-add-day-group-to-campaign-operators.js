'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // day_group 컬럼 추가
    await queryInterface.addColumn('campaign_operators', 'day_group', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '품목 내 일자 그룹 번호 (null이면 전체 품목 배정, 숫자면 해당 그룹만 배정)'
    });

    // 기존 unique 인덱스 삭제
    try {
      await queryInterface.removeIndex('campaign_operators', 'unique_campaign_operator');
    } catch (error) {
      console.log('Index unique_campaign_operator does not exist, skipping...');
    }

    // 새 unique 인덱스 추가 (day_group 포함)
    await queryInterface.addIndex('campaign_operators', ['campaign_id', 'item_id', 'day_group', 'operator_id'], {
      unique: true,
      name: 'unique_campaign_operator_daygroup'
    });

    // day_group 인덱스 추가
    await queryInterface.addIndex('campaign_operators', ['day_group'], {
      name: 'campaign_operators_day_group_idx'
    });

    // 기존 데이터 마이그레이션: item_id가 있는 레코드에 대해 day_group 설정
    // 각 품목의 모든 day_group에 동일한 진행자 배정 (기존 호환성)
    const [existingAssignments] = await queryInterface.sequelize.query(`
      SELECT co.id, co.campaign_id, co.item_id, co.operator_id, co.assigned_by, co.assigned_at
      FROM campaign_operators co
      WHERE co.item_id IS NOT NULL
    `);

    for (const assignment of existingAssignments) {
      // 해당 품목의 day_group 목록 조회
      const [dayGroups] = await queryInterface.sequelize.query(`
        SELECT DISTINCT day_group
        FROM item_slots
        WHERE item_id = :itemId
        ORDER BY day_group
      `, {
        replacements: { itemId: assignment.item_id }
      });

      if (dayGroups.length > 0) {
        // 첫 번째 레코드는 day_group 업데이트
        await queryInterface.sequelize.query(`
          UPDATE campaign_operators
          SET day_group = :dayGroup
          WHERE id = :id
        `, {
          replacements: { dayGroup: dayGroups[0].day_group, id: assignment.id }
        });

        // 나머지 day_group에 대해 새 레코드 생성
        for (let i = 1; i < dayGroups.length; i++) {
          await queryInterface.sequelize.query(`
            INSERT INTO campaign_operators (campaign_id, item_id, day_group, operator_id, assigned_by, assigned_at)
            VALUES (:campaignId, :itemId, :dayGroup, :operatorId, :assignedBy, :assignedAt)
            ON CONFLICT DO NOTHING
          `, {
            replacements: {
              campaignId: assignment.campaign_id,
              itemId: assignment.item_id,
              dayGroup: dayGroups[i].day_group,
              operatorId: assignment.operator_id,
              assignedBy: assignment.assigned_by,
              assignedAt: assignment.assigned_at
            }
          });
        }
      }
    }

    console.log('Migration completed: day_group column added to campaign_operators');
  },

  async down(queryInterface, Sequelize) {
    // day_group이 다른 중복 레코드 삭제 (첫 번째만 유지)
    await queryInterface.sequelize.query(`
      DELETE FROM campaign_operators
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM campaign_operators
        GROUP BY campaign_id, item_id, operator_id
      )
    `);

    // 새 인덱스 삭제
    try {
      await queryInterface.removeIndex('campaign_operators', 'unique_campaign_operator_daygroup');
    } catch (error) {
      console.log('Index does not exist, skipping...');
    }

    try {
      await queryInterface.removeIndex('campaign_operators', 'campaign_operators_day_group_idx');
    } catch (error) {
      console.log('Index does not exist, skipping...');
    }

    // day_group 컬럼 삭제
    await queryInterface.removeColumn('campaign_operators', 'day_group');

    // 기존 인덱스 복원
    await queryInterface.addIndex('campaign_operators', ['campaign_id', 'item_id', 'operator_id'], {
      unique: true,
      name: 'unique_campaign_operator'
    });
  }
};
