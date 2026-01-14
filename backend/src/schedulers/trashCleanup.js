/**
 * 휴지통 자동 정리 스케줄러
 * 매일 자정에 30일 지난 삭제된 데이터를 영구 삭제
 */

const { Op } = require('sequelize');
const { MonthlyBrand, Campaign, Item, ItemSlot, Buyer, Image, User, CampaignOperator, sequelize } = require('../models');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 30일 지난 삭제된 데이터 영구 삭제
 */
const cleanupTrash = async () => {
  const transaction = await sequelize.transaction();
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

  console.log(`[Trash Cleanup] Starting cleanup for items deleted before ${thirtyDaysAgo.toISOString()}`);

  try {
    let deletedCounts = {
      images: 0,
      buyers: 0,
      slots: 0,
      items: 0,
      campaigns: 0,
      monthlyBrands: 0,
      users: 0
    };

    // 30일 지난 이미지 영구 삭제
    deletedCounts.images = await Image.destroy({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      transaction,
      force: true,
      paranoid: false
    });

    // 30일 지난 구매자 영구 삭제
    deletedCounts.buyers = await Buyer.destroy({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      transaction,
      force: true,
      paranoid: false
    });

    // 30일 지난 슬롯 영구 삭제
    deletedCounts.slots = await ItemSlot.destroy({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      transaction,
      force: true,
      paranoid: false
    });

    // 30일 지난 품목의 진행자 배정 삭제
    const expiredItems = await Item.findAll({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      attributes: ['id'],
      paranoid: false
    });

    if (expiredItems.length > 0) {
      await CampaignOperator.destroy({
        where: { item_id: expiredItems.map(i => i.id) },
        transaction,
        force: true
      });
    }

    // 30일 지난 품목 영구 삭제
    deletedCounts.items = await Item.destroy({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      transaction,
      force: true,
      paranoid: false
    });

    // 30일 지난 캠페인의 진행자 배정 삭제
    const expiredCampaigns = await Campaign.findAll({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      attributes: ['id'],
      paranoid: false
    });

    if (expiredCampaigns.length > 0) {
      await CampaignOperator.destroy({
        where: { campaign_id: expiredCampaigns.map(c => c.id) },
        transaction,
        force: true
      });
    }

    // 30일 지난 캠페인 영구 삭제
    deletedCounts.campaigns = await Campaign.destroy({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      transaction,
      force: true,
      paranoid: false
    });

    // 30일 지난 연월브랜드 영구 삭제
    deletedCounts.monthlyBrands = await MonthlyBrand.destroy({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      transaction,
      force: true,
      paranoid: false
    });

    // 30일 지난 사용자 영구 삭제
    deletedCounts.users = await User.destroy({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      transaction,
      force: true,
      paranoid: false
    });

    await transaction.commit();

    const totalDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0);
    console.log(`[Trash Cleanup] Completed. Deleted ${totalDeleted} items:`, deletedCounts);

    return deletedCounts;
  } catch (error) {
    await transaction.rollback();
    console.error('[Trash Cleanup] Error:', error);
    throw error;
  }
};

/**
 * 스케줄러 시작 (매일 자정 실행)
 */
const startTrashCleanupScheduler = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const msUntilMidnight = tomorrow - now;

  console.log(`[Trash Cleanup] Scheduler will start in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at midnight)`);

  // 첫 실행: 다음 자정
  setTimeout(() => {
    cleanupTrash();
    // 이후 24시간마다 실행
    setInterval(cleanupTrash, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
};

module.exports = {
  cleanupTrash,
  startTrashCleanupScheduler
};
