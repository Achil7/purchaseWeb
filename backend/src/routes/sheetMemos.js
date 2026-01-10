const express = require('express');
const router = express.Router();
const { SheetMemo } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');

/**
 * @route   GET /api/sheet-memos/campaign/:campaignId
 * @desc    캠페인별 시트 메모 조회
 * @access  Private (Operator, Sales, Admin)
 * @query   sheetType - operator 또는 sales
 * @query   viewAsUserId - Admin이 다른 사용자 대신 조회 시
 */
router.get('/campaign/:campaignId', authenticate, authorize(['operator', 'sales', 'admin']), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { sheetType, viewAsUserId } = req.query;

    if (!sheetType) {
      return res.status(400).json({
        success: false,
        message: 'sheetType이 필요합니다 (operator 또는 sales)'
      });
    }

    // 사용자 ID 결정 (Admin의 viewAs 기능 지원)
    let userId = req.user.id;
    if (req.user.role === 'admin' && viewAsUserId) {
      userId = parseInt(viewAsUserId, 10);
    }

    const memos = await SheetMemo.findAll({
      where: {
        campaign_id: campaignId,
        sheet_type: sheetType,
        user_id: userId
      },
      order: [['row_index', 'ASC'], ['col_index', 'ASC']]
    });

    res.json({
      success: true,
      data: memos
    });
  } catch (error) {
    console.error('Get sheet memos error:', error);
    res.status(500).json({
      success: false,
      message: '시트 메모 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   POST /api/sheet-memos/campaign/:campaignId/bulk
 * @desc    시트 메모 일괄 저장 (upsert)
 * @access  Private (Operator, Sales, Admin)
 * @body    { sheetType, memos: [{ row_index, col_index, value }] }
 */
router.post('/campaign/:campaignId/bulk', authenticate, authorize(['operator', 'sales', 'admin']), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { sheetType, memos, viewAsUserId } = req.body;

    if (!sheetType || !memos) {
      return res.status(400).json({
        success: false,
        message: 'sheetType과 memos가 필요합니다'
      });
    }

    // 사용자 ID 결정 (Admin의 viewAs 기능 지원)
    let userId = req.user.id;
    if (req.user.role === 'admin' && viewAsUserId) {
      userId = parseInt(viewAsUserId, 10);
    }

    // 각 메모를 upsert
    const results = [];
    for (const memo of memos) {
      const { row_index, col_index, value } = memo;

      if (value === null || value === undefined || value === '') {
        // 빈 값이면 삭제
        await SheetMemo.destroy({
          where: {
            campaign_id: campaignId,
            sheet_type: sheetType,
            user_id: userId,
            row_index,
            col_index
          }
        });
      } else {
        // 값이 있으면 upsert
        const [record, created] = await SheetMemo.upsert({
          campaign_id: campaignId,
          sheet_type: sheetType,
          user_id: userId,
          row_index,
          col_index,
          value
        });
        results.push(record);
      }
    }

    res.json({
      success: true,
      message: '메모가 저장되었습니다',
      data: results
    });
  } catch (error) {
    console.error('Save sheet memos error:', error);
    res.status(500).json({
      success: false,
      message: '시트 메모 저장 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   DELETE /api/sheet-memos/campaign/:campaignId
 * @desc    캠페인의 모든 메모 삭제
 * @access  Private (Operator, Sales, Admin)
 */
router.delete('/campaign/:campaignId', authenticate, authorize(['operator', 'sales', 'admin']), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { sheetType, viewAsUserId } = req.query;

    // 사용자 ID 결정
    let userId = req.user.id;
    if (req.user.role === 'admin' && viewAsUserId) {
      userId = parseInt(viewAsUserId, 10);
    }

    const where = {
      campaign_id: campaignId,
      user_id: userId
    };

    if (sheetType) {
      where.sheet_type = sheetType;
    }

    await SheetMemo.destroy({ where });

    res.json({
      success: true,
      message: '메모가 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete sheet memos error:', error);
    res.status(500).json({
      success: false,
      message: '시트 메모 삭제 중 오류가 발생했습니다'
    });
  }
});

module.exports = router;
