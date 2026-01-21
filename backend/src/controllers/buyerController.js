const { Buyer, Item, Image, User, Campaign, ItemSlot } = require('../models');
const { sequelize, Sequelize } = require('../models');
const { normalizeAccountNumber } = require('../utils/accountNormalizer');
const { Op } = Sequelize;

/**
 * 임시 Buyer 병합 함수
 * 진행자가 구매자를 등록할 때, 같은 계좌번호로 선 업로드된 임시 Buyer가 있으면 이미지를 이관하고 삭제
 */
async function mergeTempBuyer(itemId, realBuyer, transaction = null) {
  const accountNorm = realBuyer.account_normalized;
  if (!accountNorm) return;

  // 같은 품목에서 같은 계좌번호를 가진 임시 Buyer 찾기
  const tempBuyer = await Buyer.findOne({
    where: {
      item_id: itemId,
      account_normalized: accountNorm,
      is_temporary: true
    },
    transaction
  });

  if (tempBuyer) {
    // 임시 Buyer의 이미지들을 실제 Buyer로 이관
    await Image.update(
      { buyer_id: realBuyer.id },
      {
        where: { buyer_id: tempBuyer.id },
        transaction
      }
    );

    // 임시 Buyer 삭제
    await tempBuyer.destroy({ transaction });
  }
}

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
      return sum + parseInt(buyer.amount || 0, 10);
    }, 0);

    res.json({
      success: true,
      data: buyers,
      count: buyers.length,
      totalAmount
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

    // 계좌번호 정규화
    const account_normalized = normalizeAccountNumber(account_info);

    const buyer = await Buyer.create({
      item_id: itemId,
      order_number,
      buyer_name,
      recipient_name,
      user_id,
      contact,
      address,
      account_info,
      account_normalized,
      amount,
      notes,
      created_by,
      is_temporary: false
    });

    // 임시 Buyer가 있으면 병합 (선 업로드 케이스)
    await mergeTempBuyer(itemId, buyer);

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

    // 계좌번호 정규화
    const account_normalized = normalizeAccountNumber(account_info);

    const buyer = await Buyer.create({
      item_id: itemId,
      order_number,
      buyer_name,
      recipient_name,
      user_id,
      contact,
      address,
      account_info,
      account_normalized,
      amount: parseInt(amount.replace(/,/g, ''), 10), // 콤마 제거, 정수로 변환
      created_by,
      is_temporary: false
    });

    // 임시 Buyer가 있으면 병합 (선 업로드 케이스)
    await mergeTempBuyer(itemId, buyer);

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

    // account_info가 변경되면 account_normalized도 재계산
    const updateData = { ...req.body };
    if (updateData.account_info !== undefined) {
      updateData.account_normalized = normalizeAccountNumber(updateData.account_info);
    }

    await buyer.update(updateData);

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

/**
 * 다중 구매자 일괄 추가 (진행자용)
 * POST /api/buyers/item/:itemId/bulk
 */
exports.createBuyersBulk = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { itemId } = req.params;
    const { buyers: buyersData } = req.body; // 배열 형태

    if (!Array.isArray(buyersData) || buyersData.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '구매자 데이터가 필요합니다'
      });
    }

    // 품목 존재 확인
    const item = await Item.findByPk(itemId, { transaction });
    if (!item) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    const created_by = req.user?.id || null;
    const createdBuyers = [];
    const errors = [];

    for (let i = 0; i < buyersData.length; i++) {
      const data = buyersData[i];

      try {
        // 필수 필드 검증
        if (!data.order_number || !data.buyer_name || !data.recipient_name) {
          errors.push({ index: i, message: '필수 필드(주문번호, 구매자, 수취인)가 누락되었습니다' });
          continue;
        }

        // 계좌번호 정규화
        const account_normalized = normalizeAccountNumber(data.account_info);

        const buyer = await Buyer.create({
          item_id: itemId,
          order_number: data.order_number,
          buyer_name: data.buyer_name,
          recipient_name: data.recipient_name,
          user_id: data.user_id || null,
          contact: data.contact || null,
          address: data.address || null,
          account_info: data.account_info || null,
          account_normalized,
          amount: data.amount ? parseInt(String(data.amount).replace(/,/g, ''), 10) : 0,
          notes: data.notes || null,
          created_by,
          is_temporary: false
        }, { transaction });

        // 임시 Buyer 병합 (선 업로드 케이스)
        await mergeTempBuyer(itemId, buyer, transaction);

        createdBuyers.push(buyer);
      } catch (itemError) {
        errors.push({ index: i, message: itemError.message });
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `${createdBuyers.length}명의 구매자가 추가되었습니다`,
      data: createdBuyers,
      count: createdBuyers.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Create buyers bulk error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 일괄 추가 실패',
      error: error.message
    });
  }
};

/**
 * 송장번호 수정 (Sales, Admin 전용)
 * PATCH /api/buyers/:id/tracking
 */
exports.updateTrackingNumber = async (req, res) => {
  try {
    const { id } = req.params;
    const { tracking_number } = req.body;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: '구매자를 찾을 수 없습니다'
      });
    }

    await buyer.update({ tracking_number });

    res.json({
      success: true,
      message: '송장번호가 업데이트되었습니다',
      data: buyer
    });
  } catch (error) {
    console.error('Update tracking number error:', error);
    res.status(500).json({
      success: false,
      message: '송장번호 수정 실패',
      error: error.message
    });
  }
};

/**
 * 송장정보(송장번호+택배사) 수정 (Admin 전용)
 * PATCH /api/buyers/:id/tracking-info
 */
exports.updateTrackingInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { tracking_number, courier_company } = req.body;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: '구매자를 찾을 수 없습니다'
      });
    }

    const updateData = {};
    if (tracking_number !== undefined) {
      updateData.tracking_number = tracking_number || null;
    }
    if (courier_company !== undefined) {
      updateData.courier_company = courier_company || null;
    }

    await buyer.update(updateData);

    res.json({
      success: true,
      message: '송장정보가 수정되었습니다',
      data: buyer
    });
  } catch (error) {
    console.error('Update tracking info error:', error);
    res.status(500).json({
      success: false,
      message: '송장정보 수정 실패',
      error: error.message
    });
  }
};

/**
 * 송장번호 일괄 입력 (Admin 전용)
 * POST /api/buyers/item/:itemId/tracking-bulk
 * 구매자 리스트 순서대로 송장번호를 매칭 (정렬 X, created_at ASC 순서)
 */
exports.updateTrackingNumbersBulk = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { itemId } = req.params;
    const { tracking_numbers, courier_company } = req.body; // 줄바꿈으로 구분된 송장번호 문자열 또는 배열 + 택배사

    // 품목 존재 확인
    const item = await Item.findByPk(itemId, { transaction });
    if (!item) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    // 송장번호 배열로 변환 (문자열이면 줄바꿈으로 분리)
    let trackingList;
    if (typeof tracking_numbers === 'string') {
      trackingList = tracking_numbers
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    } else if (Array.isArray(tracking_numbers)) {
      trackingList = tracking_numbers.map(t => String(t).trim()).filter(t => t.length > 0);
    } else {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '송장번호 데이터가 필요합니다'
      });
    }

    // 해당 품목의 구매자 목록 조회 (등록 순서대로 - created_at ASC)
    // 임시 구매자는 제외
    const buyers = await Buyer.findAll({
      where: {
        item_id: itemId,
        is_temporary: false
      },
      order: [['created_at', 'ASC']],
      transaction
    });

    // 개수 불일치 경고
    if (trackingList.length !== buyers.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `송장번호 개수(${trackingList.length}개)와 구매자 수(${buyers.length}명)가 일치하지 않습니다.`,
        trackingCount: trackingList.length,
        buyerCount: buyers.length
      });
    }

    // 순서대로 송장번호 (및 택배사) 업데이트
    const updatedBuyers = [];
    for (let i = 0; i < buyers.length; i++) {
      const updateData = { tracking_number: trackingList[i] };
      if (courier_company) {
        updateData.courier_company = courier_company;
      }
      await buyers[i].update(updateData, { transaction });
      updatedBuyers.push({
        id: buyers[i].id,
        buyer_name: buyers[i].buyer_name,
        tracking_number: trackingList[i],
        courier_company: courier_company || buyers[i].courier_company
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: `${updatedBuyers.length}명의 송장번호가 입력되었습니다`,
      data: updatedBuyers,
      count: updatedBuyers.length
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Update tracking numbers bulk error:', error);
    res.status(500).json({
      success: false,
      message: '송장번호 일괄 입력 실패',
      error: error.message
    });
  }
};

/**
 * 택배사 수정 (Admin 전용)
 * PATCH /api/buyers/:id/courier
 */
exports.updateCourierCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { courier_company } = req.body;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: '구매자를 찾을 수 없습니다'
      });
    }

    await buyer.update({ courier_company });

    res.json({
      success: true,
      message: '택배사가 수정되었습니다',
      data: buyer
    });
  } catch (error) {
    console.error('Update courier company error:', error);
    res.status(500).json({
      success: false,
      message: '택배사 수정 실패',
      error: error.message
    });
  }
};

/**
 * 월별 구매자 조회 (이미지 업로드 날짜 기준, Asia/Seoul)
 * GET /api/buyers/by-month?year=2025&month=12
 * 이미지가 있는 구매자만 조회 (이미지 업로드 날짜가 해당 월에 속하는 경우)
 */
exports.getBuyersByMonth = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'year와 month 파라미터가 필요합니다'
      });
    }

    const yearInt = parseInt(year, 10);
    const monthInt = parseInt(month, 10);

    if (isNaN(yearInt) || isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({
        success: false,
        message: '유효한 year와 month 값이 필요합니다'
      });
    }

    // Asia/Seoul 기준으로 해당 월의 시작과 끝 계산
    // UTC로 저장된 시간을 Asia/Seoul(+9)으로 변환해서 필터링
    // 예: 2025년 12월 (Asia/Seoul) = 2025-11-30 15:00:00 UTC ~ 2025-12-31 14:59:59 UTC
    const startDateKST = new Date(Date.UTC(yearInt, monthInt - 1, 1, -9, 0, 0));
    const endDateKST = new Date(Date.UTC(yearInt, monthInt, 1, -9, 0, 0));

    // 해당 월에 이미지가 업로드된 구매자 조회
    // Image.created_at이 해당 범위에 속하는 구매자
    const buyers = await Buyer.findAll({
      where: {
        is_temporary: false
      },
      include: [
        {
          model: Image,
          as: 'images',
          where: {
            created_at: {
              [Op.gte]: startDateKST,
              [Op.lt]: endDateKST
            }
          },
          required: true, // INNER JOIN - 이미지가 있는 구매자만
          attributes: ['id', 's3_url', 'file_name', 'created_at']
        },
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'product_name', 'deposit_name', 'campaign_id'],
          include: [
            {
              model: Campaign,
              as: 'campaign',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [[{ model: Image, as: 'images' }, 'created_at', 'DESC']]
    });

    // 총 금액 계산
    const totalAmount = buyers.reduce((sum, buyer) => {
      return sum + parseInt(buyer.amount || 0, 10);
    }, 0);

    // 응답 데이터 가공
    const data = buyers.map(buyer => ({
      id: buyer.id,
      order_number: buyer.order_number,
      buyer_name: buyer.buyer_name,
      recipient_name: buyer.recipient_name,
      amount: buyer.amount,
      tracking_number: buyer.tracking_number,
      payment_status: buyer.payment_status,
      image_uploaded_at: buyer.images && buyer.images.length > 0 ? buyer.images[0].created_at : null,
      image_url: buyer.images && buyer.images.length > 0 ? buyer.images[0].s3_url : null,
      item: buyer.item ? {
        id: buyer.item.id,
        product_name: buyer.item.product_name,
        deposit_name: buyer.item.deposit_name
      } : null,
      campaign: buyer.item?.campaign ? {
        id: buyer.item.campaign.id,
        name: buyer.item.campaign.name
      } : null
    }));

    res.json({
      success: true,
      data,
      count: data.length,
      totalAmount,
      period: {
        year: yearInt,
        month: monthInt
      }
    });
  } catch (error) {
    console.error('Get buyers by month error:', error);
    res.status(500).json({
      success: false,
      message: '월별 구매자 조회 실패',
      error: error.message
    });
  }
};

/**
 * 배송지연 상태 토글 (Admin, Operator)
 * PATCH /api/buyers/:id/shipping-delayed
 */
exports.toggleShippingDelayed = async (req, res) => {
  try {
    const { id } = req.params;
    const { shipping_delayed } = req.body;

    const buyer = await Buyer.findByPk(id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: '구매자를 찾을 수 없습니다'
      });
    }

    await buyer.update({ shipping_delayed: shipping_delayed ?? !buyer.shipping_delayed });

    res.json({
      success: true,
      message: shipping_delayed ? '배송지연으로 표시되었습니다' : '배송지연이 해제되었습니다',
      data: buyer
    });
  } catch (error) {
    console.error('Toggle shipping delayed error:', error);
    res.status(500).json({
      success: false,
      message: '배송지연 상태 변경 실패',
      error: error.message
    });
  }
};

/**
 * 일별 구매자 조회 (리뷰샷 업로드 날짜 기준, Asia/Seoul)
 * GET /api/buyers/by-date?year=2025&month=12&day=13
 * 해당 날짜에 리뷰샷을 업로드한 구매자만 조회 (연월브랜드/캠페인/제품 무관)
 */
exports.getBuyersByDate = async (req, res) => {
  try {
    const { year, month, day } = req.query;

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        message: 'year, month, day 파라미터가 필요합니다'
      });
    }

    const yearInt = parseInt(year, 10);
    const monthInt = parseInt(month, 10);
    const dayInt = parseInt(day, 10);

    if (isNaN(yearInt) || isNaN(monthInt) || isNaN(dayInt) || monthInt < 1 || monthInt > 12 || dayInt < 1 || dayInt > 31) {
      return res.status(400).json({
        success: false,
        message: '유효한 year, month, day 값이 필요합니다'
      });
    }

    // Asia/Seoul 기준으로 해당 일의 시작과 끝 계산
    // 예: 2025년 12월 13일 (Asia/Seoul) = 2025-12-12 15:00:00 UTC ~ 2025-12-13 14:59:59 UTC
    const startDateKST = new Date(Date.UTC(yearInt, monthInt - 1, dayInt, -9, 0, 0));
    const endDateKST = new Date(Date.UTC(yearInt, monthInt - 1, dayInt + 1, -9, 0, 0));

    // 해당 날짜에 리뷰샷(이미지)을 업로드한 구매자만 조회
    // Image.created_at이 해당 날짜에 속하는 구매자
    const buyers = await Buyer.findAll({
      where: {
        is_temporary: false
      },
      include: [
        {
          model: Image,
          as: 'images',
          where: {
            created_at: {
              [Op.gte]: startDateKST,
              [Op.lt]: endDateKST
            }
          },
          required: true,  // INNER JOIN - 해당 날짜에 이미지를 업로드한 구매자만
          attributes: ['id', 's3_url', 'file_name', 'created_at']
        },
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'product_name', 'deposit_name', 'campaign_id'],
          include: [
            {
              model: Campaign,
              as: 'campaign',
              attributes: ['id', 'name']
            }
          ]
        },
        {
          model: ItemSlot,
          as: 'slot',
          attributes: ['id', 'review_cost'],
          required: false
        }
      ],
      order: [[{ model: Image, as: 'images' }, 'created_at', 'DESC']]
    });

    // 총 금액 계산
    const totalAmount = buyers.reduce((sum, buyer) => {
      return sum + parseInt(buyer.amount || 0, 10);
    }, 0);

    // 응답 데이터 가공
    const data = buyers.map(buyer => ({
      id: buyer.id,
      order_number: buyer.order_number,
      buyer_name: buyer.buyer_name,
      recipient_name: buyer.recipient_name,
      account_info: buyer.account_info,  // 계좌 추가
      amount: buyer.amount,
      tracking_number: buyer.tracking_number,
      courier_company: buyer.courier_company,
      payment_status: buyer.payment_status,
      payment_confirmed_at: buyer.payment_confirmed_at,  // 입금확인 날짜 추가
      created_at: buyer.created_at,
      image_uploaded_at: buyer.images && buyer.images.length > 0 ? buyer.images[0].created_at : null,
      image_url: buyer.images && buyer.images.length > 0 ? buyer.images[0].s3_url : null,
      item: buyer.item ? {
        id: buyer.item.id,
        product_name: buyer.item.product_name,
        deposit_name: buyer.item.deposit_name
      } : null,
      campaign: buyer.item?.campaign ? {
        id: buyer.item.campaign.id,
        name: buyer.item.campaign.name
      } : null,
      review_cost: buyer.slot?.review_cost || null  // 리뷰비 추가
    }));

    res.json({
      success: true,
      data,
      count: data.length,
      totalAmount,
      period: {
        year: yearInt,
        month: monthInt,
        day: dayInt
      }
    });
  } catch (error) {
    console.error('Get buyers by date error:', error);
    res.status(500).json({
      success: false,
      message: '일별 구매자 조회 실패',
      error: error.message
    });
  }
};
