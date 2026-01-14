const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middleware/auth');
const { MonthlyBrand, Campaign, Item, ItemSlot, Buyer, Image, User, CampaignOperator } = require('../models');

/**
 * @route   GET /api/trash
 * @desc    휴지통 목록 조회 (삭제된 데이터)
 * @access  Private (Admin, Sales, Operator)
 */
router.get('/', authenticate, authorize(['admin', 'sales', 'operator']), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // 삭제된 연월브랜드
    let monthlyBrandWhere = { deleted_at: { [Op.ne]: null } };
    if (userRole === 'sales') {
      monthlyBrandWhere.created_by = userId;
    }

    const monthlyBrands = await MonthlyBrand.findAll({
      where: monthlyBrandWhere,
      paranoid: false,  // 삭제된 데이터 포함
      include: [
        { model: User, as: 'brand', attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] }
      ],
      order: [['deleted_at', 'DESC']]
    });

    // 삭제된 캠페인 (연월브랜드와 별도로 삭제된 것들)
    let campaignWhere = {
      deleted_at: { [Op.ne]: null },
      monthly_brand_id: { [Op.or]: [null, { [Op.notIn]: monthlyBrands.map(mb => mb.id) }] }
    };
    if (userRole === 'sales') {
      campaignWhere.created_by = userId;
    }

    const campaigns = await Campaign.findAll({
      where: campaignWhere,
      paranoid: false,
      include: [
        { model: User, as: 'brand', attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: MonthlyBrand, as: 'monthlyBrand', attributes: ['id', 'name'], paranoid: false }
      ],
      order: [['deleted_at', 'DESC']]
    });

    // 삭제된 품목 (캠페인과 별도로 삭제된 것들)
    let itemWhere = { deleted_at: { [Op.ne]: null } };

    const items = await Item.findAll({
      where: itemWhere,
      paranoid: false,
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'created_by'],
          paranoid: false
        }
      ],
      order: [['deleted_at', 'DESC']]
    });

    // Sales인 경우 자신의 캠페인에 속한 품목만 필터
    const filteredItems = userRole === 'sales'
      ? items.filter(item => item.campaign?.created_by === userId)
      : items;

    // 삭제된 사용자 (Admin만)
    let users = [];
    if (userRole === 'admin') {
      users = await User.findAll({
        where: { deleted_at: { [Op.ne]: null } },
        paranoid: false,
        attributes: ['id', 'username', 'name', 'email', 'role', 'deleted_at'],
        order: [['deleted_at', 'DESC']]
      });
    }

    // 30일 후 영구 삭제 예정일 계산
    const addExpiryDate = (items) => items.map(item => ({
      ...item.toJSON(),
      expires_at: new Date(new Date(item.deleted_at).getTime() + 30 * 24 * 60 * 60 * 1000)
    }));

    res.json({
      success: true,
      data: {
        monthlyBrands: addExpiryDate(monthlyBrands),
        campaigns: addExpiryDate(campaigns),
        items: addExpiryDate(filteredItems),
        users: addExpiryDate(users)
      },
      counts: {
        monthlyBrands: monthlyBrands.length,
        campaigns: campaigns.length,
        items: filteredItems.length,
        users: users.length,
        total: monthlyBrands.length + campaigns.length + filteredItems.length + users.length
      }
    });
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({
      success: false,
      message: '휴지통 조회 실패',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/trash/restore/:type/:id
 * @desc    휴지통에서 복원
 * @access  Private (Admin, Sales, Operator)
 */
router.post('/restore/:type/:id', authenticate, authorize(['admin', 'sales', 'operator']), async (req, res) => {
  const sequelize = require('../models').sequelize;
  const transaction = await sequelize.transaction();

  try {
    const { type, id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    let restoredItem;
    let restoredCount = { main: 0, campaigns: 0, items: 0, slots: 0, buyers: 0, images: 0 };

    if (type === 'monthlyBrand') {
      const monthlyBrand = await MonthlyBrand.findByPk(id, { paranoid: false });
      if (!monthlyBrand) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: '연월브랜드를 찾을 수 없습니다' });
      }

      // 권한 체크
      if (userRole !== 'admin' && monthlyBrand.created_by !== userId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: '복원 권한이 없습니다' });
      }

      // 연월브랜드 복원
      await monthlyBrand.restore({ transaction });
      restoredCount.main = 1;

      // 하위 캠페인들도 복원
      const campaigns = await Campaign.findAll({
        where: { monthly_brand_id: id, deleted_at: { [Op.ne]: null } },
        paranoid: false
      });

      for (const campaign of campaigns) {
        await campaign.restore({ transaction });
        restoredCount.campaigns++;

        // 하위 품목들 복원
        const items = await Item.findAll({
          where: { campaign_id: campaign.id, deleted_at: { [Op.ne]: null } },
          paranoid: false
        });

        for (const item of items) {
          await item.restore({ transaction });
          restoredCount.items++;

          // 슬롯 복원
          const slotsRestored = await ItemSlot.update(
            { deleted_at: null },
            { where: { item_id: item.id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
          );
          restoredCount.slots += slotsRestored[0];

          // 구매자 복원
          const buyersRestored = await Buyer.update(
            { deleted_at: null },
            { where: { item_id: item.id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
          );
          restoredCount.buyers += buyersRestored[0];

          // 이미지 복원
          const imagesRestored = await Image.update(
            { deleted_at: null },
            { where: { item_id: item.id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
          );
          restoredCount.images += imagesRestored[0];
        }
      }

      restoredItem = monthlyBrand;

    } else if (type === 'campaign') {
      const campaign = await Campaign.findByPk(id, { paranoid: false });
      if (!campaign) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: '캠페인을 찾을 수 없습니다' });
      }

      if (userRole !== 'admin' && campaign.created_by !== userId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: '복원 권한이 없습니다' });
      }

      await campaign.restore({ transaction });
      restoredCount.main = 1;

      // 하위 품목들 복원
      const items = await Item.findAll({
        where: { campaign_id: id, deleted_at: { [Op.ne]: null } },
        paranoid: false
      });

      for (const item of items) {
        await item.restore({ transaction });
        restoredCount.items++;

        const slotsRestored = await ItemSlot.update(
          { deleted_at: null },
          { where: { item_id: item.id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
        );
        restoredCount.slots += slotsRestored[0];

        const buyersRestored = await Buyer.update(
          { deleted_at: null },
          { where: { item_id: item.id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
        );
        restoredCount.buyers += buyersRestored[0];

        const imagesRestored = await Image.update(
          { deleted_at: null },
          { where: { item_id: item.id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
        );
        restoredCount.images += imagesRestored[0];
      }

      restoredItem = campaign;

    } else if (type === 'item') {
      const item = await Item.findByPk(id, {
        paranoid: false,
        include: [{ model: Campaign, as: 'campaign', paranoid: false }]
      });
      if (!item) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: '품목을 찾을 수 없습니다' });
      }

      if (userRole !== 'admin' && item.campaign?.created_by !== userId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: '복원 권한이 없습니다' });
      }

      await item.restore({ transaction });
      restoredCount.main = 1;

      const slotsRestored = await ItemSlot.update(
        { deleted_at: null },
        { where: { item_id: id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
      );
      restoredCount.slots += slotsRestored[0];

      const buyersRestored = await Buyer.update(
        { deleted_at: null },
        { where: { item_id: id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
      );
      restoredCount.buyers += buyersRestored[0];

      const imagesRestored = await Image.update(
        { deleted_at: null },
        { where: { item_id: id, deleted_at: { [Op.ne]: null } }, transaction, paranoid: false }
      );
      restoredCount.images += imagesRestored[0];

      restoredItem = item;

    } else if (type === 'user') {
      if (userRole !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: '사용자 복원은 관리자만 가능합니다' });
      }

      const user = await User.findByPk(id, { paranoid: false });
      if (!user) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
      }

      await user.restore({ transaction });
      restoredCount.main = 1;
      restoredItem = user;

    } else {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '유효하지 않은 타입입니다' });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: '복원되었습니다',
      data: {
        type,
        id: restoredItem.id,
        name: restoredItem.name || restoredItem.product_name || restoredItem.username,
        restored: restoredCount
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Restore from trash error:', error);
    res.status(500).json({
      success: false,
      message: '복원 실패',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/trash/permanent/:type/:id
 * @desc    영구 삭제
 * @access  Private (Admin only)
 */
router.delete('/permanent/:type/:id', authenticate, authorize(['admin']), async (req, res) => {
  const sequelize = require('../models').sequelize;
  const transaction = await sequelize.transaction();

  try {
    const { type, id } = req.params;

    let deletedStats = { campaigns: 0, items: 0, slots: 0, buyers: 0, images: 0, operators: 0 };

    if (type === 'monthlyBrand') {
      const monthlyBrand = await MonthlyBrand.findByPk(id, {
        paranoid: false,
        include: [{
          model: Campaign,
          as: 'campaigns',
          paranoid: false,
          include: [{
            model: Item,
            as: 'items',
            paranoid: false
          }]
        }]
      });

      if (!monthlyBrand) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: '연월브랜드를 찾을 수 없습니다' });
      }

      // 하위 데이터 영구 삭제 (force: true)
      for (const campaign of monthlyBrand.campaigns || []) {
        await CampaignOperator.destroy({ where: { campaign_id: campaign.id }, transaction, force: true });
        deletedStats.operators++;

        for (const item of campaign.items || []) {
          await Image.destroy({ where: { item_id: item.id }, transaction, force: true, paranoid: false });
          await Buyer.destroy({ where: { item_id: item.id }, transaction, force: true, paranoid: false });
          await ItemSlot.destroy({ where: { item_id: item.id }, transaction, force: true, paranoid: false });
        }
        await Item.destroy({ where: { campaign_id: campaign.id }, transaction, force: true, paranoid: false });
        deletedStats.items++;
      }
      await Campaign.destroy({ where: { monthly_brand_id: id }, transaction, force: true, paranoid: false });
      await monthlyBrand.destroy({ transaction, force: true });

    } else if (type === 'campaign') {
      const campaign = await Campaign.findByPk(id, {
        paranoid: false,
        include: [{ model: Item, as: 'items', paranoid: false }]
      });

      if (!campaign) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: '캠페인을 찾을 수 없습니다' });
      }

      await CampaignOperator.destroy({ where: { campaign_id: id }, transaction, force: true });

      for (const item of campaign.items || []) {
        await Image.destroy({ where: { item_id: item.id }, transaction, force: true, paranoid: false });
        await Buyer.destroy({ where: { item_id: item.id }, transaction, force: true, paranoid: false });
        await ItemSlot.destroy({ where: { item_id: item.id }, transaction, force: true, paranoid: false });
      }
      await Item.destroy({ where: { campaign_id: id }, transaction, force: true, paranoid: false });
      await campaign.destroy({ transaction, force: true });

    } else if (type === 'item') {
      const item = await Item.findByPk(id, { paranoid: false });
      if (!item) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: '품목을 찾을 수 없습니다' });
      }

      await Image.destroy({ where: { item_id: id }, transaction, force: true, paranoid: false });
      await Buyer.destroy({ where: { item_id: id }, transaction, force: true, paranoid: false });
      await ItemSlot.destroy({ where: { item_id: id }, transaction, force: true, paranoid: false });
      await CampaignOperator.destroy({ where: { item_id: id }, transaction, force: true });
      await item.destroy({ transaction, force: true });

    } else if (type === 'user') {
      const user = await User.findByPk(id, { paranoid: false });
      if (!user) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
      }

      await user.destroy({ transaction, force: true });

    } else {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '유효하지 않은 타입입니다' });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: '영구 삭제되었습니다'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Permanent delete error:', error);
    res.status(500).json({
      success: false,
      message: '영구 삭제 실패',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/trash/empty
 * @desc    휴지통 비우기 (30일 지난 데이터 영구 삭제)
 * @access  Private (Admin only)
 */
router.delete('/empty', authenticate, authorize(['admin']), async (req, res) => {
  const sequelize = require('../models').sequelize;
  const transaction = await sequelize.transaction();

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let deletedCounts = { monthlyBrands: 0, campaigns: 0, items: 0, slots: 0, buyers: 0, images: 0, users: 0 };

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

    // 30일 지난 품목 영구 삭제
    deletedCounts.items = await Item.destroy({
      where: { deleted_at: { [Op.lt]: thirtyDaysAgo } },
      transaction,
      force: true,
      paranoid: false
    });

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

    res.json({
      success: true,
      message: `${totalDeleted}개 항목이 영구 삭제되었습니다`,
      data: deletedCounts
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Empty trash error:', error);
    res.status(500).json({
      success: false,
      message: '휴지통 비우기 실패',
      error: error.message
    });
  }
});

module.exports = router;
