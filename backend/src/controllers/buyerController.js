const { Buyer, Item, Image, User, Campaign } = require('../models');
const { sequelize } = require('../models');

/**
 * 품목의 구매자 목록 조회
 */
exports.getBuyersByItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const buyers = await Buyer.findAll({
      where: { item_id: itemId },
      include: [
        {
          model: Image,
          as: 'images',
          attributes: ['id', 's3_url', 'file_name', 'order_number', 'created_at']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // 금액 총합 계산
    const totalAmount = buyers.reduce((sum, buyer) => {
      return sum + parseFloat(buyer.amount || 0);
    }, 0);

    res.json({
      success: true,
      data: buyers,
      count: buyers.length,
      totalAmount: totalAmount.toFixed(2)
    });
  } catch (error) {
    console.error('Get buyers error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * 구매자 상세 조회
 */
exports.getBuyer = async (req, res) => {
  try {
    const { id } = req.params;

    const buyer = await Buyer.findByPk(id, {
      include: [
        {
          model: Item,
          as: 'item',
          include: [{ model: Campaign, as: 'campaign' }]
        },
        {
          model: Image,
          as: 'images'
        }
      ]
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: '구매자를 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      data: buyer
    });
  } catch (error) {
    console.error('Get buyer error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 조회 실패',
      error: error.message
    });
  }
};

/**
 * 구매자 추가
 */
exports.createBuyer = async (req, res) => {
  try {
    const { itemId } = req.params;
    const {
      order_number,
      buyer_name,
      recipient_name,
      user_id,
      contact,
      address,
      account_info,
      amount,
      notes
    } = req.body;

    // 품목 존재 확인
    const item = await Item.findByPk(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    // JWT에서 사용자 ID 가져오기
    const created_by = req.user?.id || null;

    const buyer = await Buyer.create({
      item_id: itemId,
      order_number,
      buyer_name,
      recipient_name,
      user_id,
      contact,
      address,
      account_info,
      amount,
      notes,
      created_by
    });

    res.status(201).json({
      success: true,
      message: '구매자가 추가되었습니다',
      data: buyer
    });
  } catch (error) {
    console.error('Create buyer error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 추가 실패',
      error: error.message
    });
  }
};

/**
 * 슬래시로 구분된 데이터 파싱 후 구매자 추가
 */
exports.parseBuyer = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { data } = req.body; // "주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액"

    if (!data) {
      return res.status(400).json({
        success: false,
        message: '데이터가 필요합니다'
      });
    }

    // 슬래시로 파싱
    const parts = data.split('/').map(p => p.trim());

    if (parts.length < 8) {
      return res.status(400).json({
        success: false,
        message: '데이터 형식이 올바르지 않습니다. 8개 필드가 필요합니다.'
      });
    }

    const [
      order_number,
      buyer_name,
      recipient_name,
      user_id,
      contact,
      address,
      account_info,
      amount
    ] = parts;

    // 품목 존재 확인
    const item = await Item.findByPk(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    // JWT에서 사용자 ID 가져오기
    const created_by = req.user?.id || null;

    const buyer = await Buyer.create({
      item_id: itemId,
      order_number,
      buyer_name,
      recipient_name,
      user_id,
      contact,
      address,
      account_info,
      amount: parseFloat(amount.replace(/,/g, '')), // 콤마 제거
      created_by
    });

    res.status(201).json({
      success: true,
      message: '구매자가 추가되었습니다 (파싱)',
      data: buyer
    });
  } catch (error) {
    console.error('Parse buyer error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 파싱 및 추가 실패',
      error: error.message
    });
  }
};

/**
 * 구매자 수정
 */
exports.updateBuyer = async (req, res) => {
  try {
    const { id } = req.params;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: '구매자를 찾을 수 없습니다'
      });
    }

    await buyer.update(req.body);

    res.json({
      success: true,
      message: '구매자 정보가 수정되었습니다',
      data: buyer
    });
  } catch (error) {
    console.error('Update buyer error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 수정 실패',
      error: error.message
    });
  }
};

/**
 * 구매자 삭제
 */
exports.deleteBuyer = async (req, res) => {
  try {
    const { id } = req.params;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: '구매자를 찾을 수 없습니다'
      });
    }

    await buyer.destroy();

    res.json({
      success: true,
      message: '구매자가 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete buyer error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 입금 확인 (총관리자만)
 */
exports.confirmPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body; // 'pending' or 'completed'

    // JWT에서 관리자 ID 가져오기
    const confirmed_by = req.user?.id || null;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: '구매자를 찾을 수 없습니다'
      });
    }

    await buyer.update({
      payment_status,
      payment_confirmed_by: payment_status === 'completed' ? confirmed_by : null,
      payment_confirmed_at: payment_status === 'completed' ? new Date() : null
    });

    res.json({
      success: true,
      message: '입금 상태가 업데이트되었습니다',
      data: buyer
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: '입금 확인 실패',
      error: error.message
    });
  }
};
