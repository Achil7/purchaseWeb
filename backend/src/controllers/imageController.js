const { Item, Image, Campaign, Buyer, ItemSlot } = require('../models');
const { sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;
const { uploadToS3, deleteFromS3 } = require('../config/s3');
const multer = require('multer');
const { normalizeAccountNumber } = require('../utils/accountNormalizer');
const { createNotification } = require('./notificationController');
const { getNextBusinessDay, formatDateToYYYYMMDD } = require('../utils/dateUtils');

// multer 설정 - 메모리 스토리지 사용 (S3로 직접 업로드)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한 (이미지당)
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다'), false);
    }
  }
});

// multer 미들웨어 export - 다중 파일 지원 (최대 50개)
// 에러 핸들링 래퍼 추가
const uploadArray = upload.array('images', 50);
exports.uploadMiddleware = (req, res, next) => {
  uploadArray(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: `예상하지 못한 필드입니다: ${err.field}. 'images' 필드로 파일을 전송해주세요.`
        });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: '파일 크기가 10MB를 초과했습니다.'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: '최대 50개까지 업로드 가능합니다.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || '파일 업로드 중 오류가 발생했습니다.'
      });
    }
    next();
  });
};

/**
 * 이름으로 구매자 검색 (업로드 페이지용)
 * - 해당 토큰의 day_group 내 구매자만 검색
 * - 이미지가 없는 구매자만 반환
 */
exports.searchBuyersByName = async (req, res) => {
  try {
    const { token } = req.params;
    const { name } = req.query;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '이름을 입력해주세요'
      });
    }

    const searchName = name.trim();

    // 토큰으로 ItemSlot 조회
    const slot = await ItemSlot.findOne({
      where: { upload_link_token: token },
      include: [{
        model: Item,
        as: 'item',
        attributes: ['id', 'product_name']
      }]
    });

    if (!slot || !slot.item) {
      return res.status(404).json({
        success: false,
        message: '유효하지 않은 업로드 링크입니다'
      });
    }

    const itemId = slot.item_id;
    const dayGroup = slot.day_group;

    // 해당 day_group의 모든 슬롯 ID 조회
    const slotsInGroup = await ItemSlot.findAll({
      where: {
        item_id: itemId,
        day_group: dayGroup
      },
      attributes: ['id', 'buyer_id']
    });

    // 슬롯에 연결된 buyer_id들
    const slotBuyerIds = slotsInGroup
      .map(s => s.buyer_id)
      .filter(id => id !== null);

    // slotBuyerIds가 비어있으면 해당 day_group에 구매자 없음
    if (slotBuyerIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        searchName
      });
    }

    // 해당 day_group 내 구매자만 조회 (이미지 정보 포함)
    const allBuyers = await Buyer.findAll({
      where: {
        id: { [Op.in]: slotBuyerIds },  // day_group 내 구매자만
        is_temporary: false
      },
      include: [{
        model: Image,
        as: 'images',
        attributes: ['id']
      }],
      order: [['created_at', 'ASC']]
    });

    // 계좌정보(account_info)에서 이름 추출하여 검색
    // 예: "우리은행 1002-661-758359 최은지" -> "최은지"
    // 숫자 뒤의 마지막 단어(이름) 추출
    const extractNameFromAccount = (accountInfo) => {
      if (!accountInfo) return null;
      // 숫자(계좌번호) 이후의 텍스트에서 이름 추출
      // 패턴: 숫자 뒤에 공백 후 한글 이름
      const match = accountInfo.match(/[\d-]+\s*([가-힣]+)\s*$/);
      return match ? match[1] : null;
    };

    // 계좌정보의 이름으로 필터링 (이미지 여부 관계없이 모두 반환)
    const matchedBuyers = allBuyers.filter(buyer => {
      const accountName = extractNameFromAccount(buyer.account_info);
      // 계좌정보에서 추출한 이름과 검색어 일치 여부
      return accountName && accountName === searchName;
    });

    // 결과 포맷 (hasImage 플래그 포함)
    const result = matchedBuyers.map(buyer => ({
      id: buyer.id,
      order_number: buyer.order_number || '',
      deposit_name: buyer.deposit_name || '',
      buyer_name: buyer.buyer_name || '',
      recipient_name: buyer.recipient_name || '',
      user_id: buyer.user_id || '',
      hasImage: buyer.images && buyer.images.length > 0,
      created_at: buyer.created_at
    }));

    res.json({
      success: true,
      data: result,
      count: result.length,
      searchName
    });
  } catch (error) {
    console.error('Search buyers by name error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 검색 실패',
      error: error.message
    });
  }
};

/**
 * 다중 이미지 업로드 (buyer_ids 직접 매칭)
 * - buyer_ids 배열로 구매자 직접 지정
 * - buyer_ids[i] ↔ images[i] 1:1 매칭
 */
exports.uploadImages = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token } = req.params;
    const { buyer_ids } = req.body;

    // buyer_ids 파싱 (문자열로 올 수 있음)
    let buyerIds = buyer_ids;
    if (typeof buyer_ids === 'string') {
      try {
        buyerIds = JSON.parse(buyer_ids);
      } catch {
        buyerIds = buyer_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
    }

    if (!Array.isArray(buyerIds) || buyerIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '구매자를 선택해주세요'
      });
    }

    // 파일 확인
    if (!req.files || req.files.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다'
      });
    }

    // buyerIds와 files 개수가 동일해야 함 (1:1 매핑이지만, 같은 buyerId 중복 가능)
    if (buyerIds.length !== req.files.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `구매자 ID 수(${buyerIds.length})와 이미지 수(${req.files.length})가 일치하지 않습니다`
      });
    }

    // 토큰으로 품목 조회 (ItemSlot 토큰)
    const slot = await ItemSlot.findOne({
      where: { upload_link_token: token },
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Campaign, as: 'campaign' }]
      }],
      transaction
    });

    if (!slot || !slot.item) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '유효하지 않은 업로드 링크입니다'
      });
    }

    const item = slot.item;

    // 선택된 구매자들 조회 및 검증 (중복 제거한 unique buyer_id 목록)
    const uniqueBuyerIds = [...new Set(buyerIds)];

    const buyers = await Buyer.findAll({
      where: {
        id: { [Op.in]: uniqueBuyerIds },
        item_id: item.id,
        is_temporary: false
      },
      include: [{
        model: Image,
        as: 'images',
        attributes: ['id']
      }],
      transaction
    });

    // 모든 unique buyer_id가 유효한지 확인 (같은 구매자에 여러 이미지 가능)
    if (buyers.length !== uniqueBuyerIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '일부 구매자를 찾을 수 없습니다'
      });
    }

    // 이미 이미지가 있는 구매자와 없는 구매자 분리
    const buyersWithImage = buyers.filter(b => b.images && b.images.length > 0);
    const buyersWithoutImage = buyers.filter(b => !b.images || b.images.length === 0);

    // buyer_id 순서대로 매핑 생성
    const buyerMap = {};
    buyers.forEach(b => { buyerMap[b.id] = b; });

    // 다중 이미지 업로드 - buyer_ids[i] ↔ files[i] 매칭
    const uploadedImages = [];
    const resubmittedImages = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const buyerId = buyerIds[i];
      const targetBuyer = buyerMap[buyerId];

      if (!targetBuyer) {
        continue;
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const s3Key = `uploads/${item.id}/${timestamp}_${randomSuffix}_${file.originalname}`;

      // S3에 업로드
      const s3Url = await uploadToS3(file.buffer, s3Key, file.mimetype);

      // 기존 이미지가 있는지 확인 (재제출 여부)
      const hasExistingImage = targetBuyer.images && targetBuyer.images.length > 0;
      const previousImageId = hasExistingImage ? targetBuyer.images[0].id : null;

      // 입금 확인 여부 확인 (재제출 시 중요)
      const fullBuyer = await Buyer.findByPk(targetBuyer.id, { transaction });
      const isPaymentConfirmed = fullBuyer && fullBuyer.payment_status === 'completed';

      // DB에 이미지 레코드 생성
      // 재제출인 경우: 무조건 status='pending', previous_image_id 설정 (승인 필요)
      // 신규인 경우: status='approved' (기본값)
      const image = await Image.create({
        item_id: item.id,
        buyer_id: targetBuyer.id,
        order_number: targetBuyer.order_number,
        account_normalized: targetBuyer.account_normalized,
        file_name: file.originalname,
        file_path: s3Key,
        s3_key: s3Key,
        s3_url: s3Url,
        file_size: file.size,
        mime_type: file.mimetype,
        upload_token: token,
        uploaded_by_ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        status: hasExistingImage ? 'pending' : 'approved',
        resubmitted_at: hasExistingImage ? new Date() : null,
        previous_image_id: previousImageId
      }, { transaction });

      // 입금 예정일 업데이트:
      // - 신규 업로드: 항상 업데이트
      // - 재제출 (입금 미확인): 업데이트
      // - 재제출 (입금 확인됨): 업데이트하지 않음 (날짜별 입금관리에 영향 없음)
      if (!hasExistingImage || !isPaymentConfirmed) {
        const now = new Date();
        const expectedPaymentDate = getNextBusinessDay(now);

        await Buyer.update({
          review_submitted_at: now,
          expected_payment_date: formatDateToYYYYMMDD(expectedPaymentDate)
        }, {
          where: { id: targetBuyer.id },
          transaction
        });
      }

      if (!hasExistingImage) {
        const now = new Date();
        const expectedPaymentDate = getNextBusinessDay(now);
        uploadedImages.push({
          ...image.toJSON(),
          buyer_name: targetBuyer.buyer_name,
          order_number: targetBuyer.order_number,
          expected_payment_date: formatDateToYYYYMMDD(expectedPaymentDate)
        });
      } else {
        // 재제출인 경우
        resubmittedImages.push({
          ...image.toJSON(),
          buyer_name: targetBuyer.buyer_name,
          order_number: targetBuyer.order_number,
          previousImageId: previousImageId,
          isPaymentConfirmed: isPaymentConfirmed
        });
      }
    }

    await transaction.commit();

    // 타겟 달성 체크 및 브랜드 알림 (신규 업로드만)
    if (uploadedImages.length > 0) {
      try {
        const completedCount = await Image.count({
          where: { item_id: item.id, status: 'approved' }
        });
        const targetCount = parseInt(item.total_purchase_count, 10) || 0;

        const previousCount = completedCount - uploadedImages.length;
        if (targetCount > 0 && previousCount < targetCount && completedCount >= targetCount) {
          let campaign = item.campaign;
          if (!campaign) {
            campaign = await Campaign.findByPk(item.campaign_id);
          }
          if (campaign && campaign.brand_id) {
            await createNotification(
              campaign.brand_id,
              'item_completed',
              '품목 진행 완료',
              `"${campaign.name}"의 "${item.product_name}"에 대해서 진행완료되었습니다.`,
              'item',
              item.id
            );
          }
        }
      } catch (notifyError) {
        console.error('Target notification error:', notifyError);
      }
    }

    // 재제출 시 Admin에게 알림
    if (resubmittedImages.length > 0) {
      try {
        // Admin 사용자들 조회
        const { User } = require('../models');
        const admins = await User.findAll({
          where: { role: 'admin', is_active: true },
          attributes: ['id']
        });

        let campaign = item.campaign;
        if (!campaign) {
          campaign = await Campaign.findByPk(item.campaign_id);
        }

        // 각 Admin에게 알림 전송
        for (const admin of admins) {
          await createNotification(
            admin.id,
            'image_resubmission',
            '리뷰 이미지 재제출',
            `"${campaign?.name || '캠페인'}"의 "${item.product_name}"에서 ${resubmittedImages.length}건의 리뷰 이미지가 재제출되었습니다. 승인이 필요합니다.`,
            'image',
            resubmittedImages[0].id
          );
        }
      } catch (notifyError) {
        console.error('Resubmission notification error:', notifyError);
      }
    }

    // 응답 메시지 구성
    let message = '';
    if (uploadedImages.length > 0 && resubmittedImages.length > 0) {
      message = `${uploadedImages.length}개의 이미지가 업로드되었고, ${resubmittedImages.length}개의 이미지가 재제출되어 승인 대기 중입니다.`;
    } else if (uploadedImages.length > 0) {
      message = `${uploadedImages.length}개의 이미지가 업로드되었습니다.`;
    } else if (resubmittedImages.length > 0) {
      message = `${resubmittedImages.length}개의 이미지가 재제출되어 승인 대기 중입니다. 관리자 승인 후 반영됩니다.`;
    }

    res.status(201).json({
      success: true,
      message,
      data: uploadedImages.map(img => ({
        id: img.id,
        s3_url: img.s3_url,
        buyer_name: img.buyer_name,
        order_number: img.order_number
      })),
      resubmitted: resubmittedImages.map(img => ({
        id: img.id,
        s3_url: img.s3_url,
        buyer_name: img.buyer_name,
        order_number: img.order_number,
        status: 'pending'
      })),
      totalUploaded: uploadedImages.length,
      totalResubmitted: resubmittedImages.length
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Upload images error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드 실패',
      error: error.message
    });
  }
};

/**
 * 품목의 이미지 목록 조회
 */
exports.getImagesByItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const images = await Image.findAll({
      where: { item_id: itemId },
      order: [['created_at', 'DESC']],
      attributes: ['id', 's3_url', 'file_name', 'order_number', 'account_normalized', 'created_at', 'file_size']
    });

    res.json({
      success: true,
      data: images,
      count: images.length
    });
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * 이미지 삭제 (리뷰샷 삭제)
 * - S3와 DB에서 이미지 삭제
 * - Buyer의 review_submitted_at, expected_payment_date 초기화
 * - ItemSlot의 status를 'active'로 복원
 * - 권한: admin, operator (배정된 품목만)
 */
exports.deleteImage = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const image = await Image.findByPk(id, {
      include: [
        {
          model: Buyer,
          as: 'buyer',
          attributes: ['id', 'item_id']
        },
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'campaign_id']
        }
      ],
      transaction
    });

    if (!image) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다'
      });
    }

    // 권한 체크: operator는 자신에게 배정된 품목만 삭제 가능
    if (userRole === 'operator') {
      const { CampaignOperator } = require('../models');
      const assignment = await CampaignOperator.findOne({
        where: {
          operator_id: userId,
          item_id: image.item_id
        },
        transaction
      });

      if (!assignment) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: '해당 품목에 대한 권한이 없습니다'
        });
      }
    }

    // S3에서 삭제
    try {
      await deleteFromS3(image.s3_key);
    } catch (s3Error) {
      console.error('S3 delete error:', s3Error);
      // S3 삭제 실패해도 DB 레코드는 삭제 진행
    }

    const buyerId = image.buyer_id;

    // DB에서 이미지 삭제
    await image.destroy({ transaction });

    // Buyer의 리뷰 관련 필드 초기화
    if (buyerId) {
      // 해당 Buyer에 다른 이미지가 남아있는지 확인
      const remainingImages = await Image.count({
        where: { buyer_id: buyerId },
        transaction
      });

      // 다른 이미지가 없으면 리뷰 관련 필드 초기화
      if (remainingImages === 0) {
        await Buyer.update({
          review_submitted_at: null,
          expected_payment_date: null
        }, {
          where: { id: buyerId },
          transaction
        });

        // ItemSlot의 status를 'active'로 복원
        await ItemSlot.update({
          status: 'active'
        }, {
          where: { buyer_id: buyerId },
          transaction
        });
      }
    }

    await transaction.commit();

    res.json({
      success: true,
      message: '리뷰샷이 삭제되었습니다'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: '리뷰샷 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 대기 중인 재제출 이미지 목록 조회 (Admin 전용)
 */
exports.getPendingImages = async (req, res) => {
  try {
    const images = await Image.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: Buyer,
          as: 'buyer',
          attributes: ['id', 'buyer_name', 'recipient_name', 'order_number']
        },
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'product_name'],
          include: [{
            model: Campaign,
            as: 'campaign',
            attributes: ['id', 'name']
          }]
        },
        {
          model: Image,
          as: 'previousImage',
          attributes: ['id', 's3_url', 'file_name', 'created_at']
        }
      ],
      order: [['resubmitted_at', 'DESC']]
    });

    res.json({
      success: true,
      data: images,
      count: images.length
    });
  } catch (error) {
    console.error('Get pending images error:', error);
    res.status(500).json({
      success: false,
      message: '대기 중인 이미지 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * 재제출 이미지 승인 (Admin 전용)
 * - 이전 이미지 삭제 (S3 + DB)
 * - 새 이미지 status를 'approved'로 변경
 */
exports.approveImage = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const image = await Image.findByPk(id, {
      include: [
        { model: Image, as: 'previousImage' },
        { model: Buyer, as: 'buyer' }
      ],
      transaction
    });

    if (!image) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다'
      });
    }

    if (image.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '대기 중인 이미지만 승인할 수 있습니다'
      });
    }

    // 이전 이미지가 있으면 삭제
    if (image.previousImage) {
      try {
        await deleteFromS3(image.previousImage.s3_key);
      } catch (s3Error) {
        console.error('S3 delete previous image error:', s3Error);
      }
      await image.previousImage.destroy({ transaction });
    }

    // 새 이미지 승인
    await image.update({
      status: 'approved',
      previous_image_id: null
    }, { transaction });

    // 입금 예정일 업데이트 (재제출 승인 시점 기준)
    // 단, 입금 확인된 구매자는 리뷰 제출일을 업데이트하지 않음 (날짜별 입금관리에 영향 없음)
    if (image.buyer) {
      const isPaymentConfirmed = image.buyer.payment_status === 'completed';

      // 입금 미확인인 경우에만 리뷰 제출일 업데이트
      if (!isPaymentConfirmed) {
        const now = new Date();
        const expectedPaymentDate = getNextBusinessDay(now);

        await Buyer.update({
          review_submitted_at: now,
          expected_payment_date: formatDateToYYYYMMDD(expectedPaymentDate)
        }, {
          where: { id: image.buyer.id },
          transaction
        });
      }

      // 해당 구매자의 슬롯 상태를 '재제출완료'로 변경
      const slot = await ItemSlot.findOne({
        where: { buyer_id: image.buyer.id },
        transaction
      });

      if (slot) {
        await slot.update({ status: 'resubmitted' }, { transaction });
      }
    }

    await transaction.commit();

    res.json({
      success: true,
      message: '이미지가 승인되었습니다'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Approve image error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 승인 실패',
      error: error.message
    });
  }
};

/**
 * 재제출 이미지 거절 (Admin 전용)
 * - 새 이미지 삭제 (S3 + DB)
 * - 이전 이미지 유지
 */
exports.rejectImage = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const image = await Image.findByPk(id, { transaction });

    if (!image) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다'
      });
    }

    if (image.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '대기 중인 이미지만 거절할 수 있습니다'
      });
    }

    // 새 이미지 S3에서 삭제
    try {
      await deleteFromS3(image.s3_key);
    } catch (s3Error) {
      console.error('S3 delete rejected image error:', s3Error);
    }

    // 새 이미지 DB에서 삭제
    await image.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: '이미지가 거절되었습니다'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Reject image error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 거절 실패',
      error: error.message
    });
  }
};

/**
 * 대기 중인 재제출 이미지 개수 조회 (Admin 알림 배지용)
 */
exports.getPendingCount = async (req, res) => {
  try {
    const count = await Image.count({
      where: { status: 'pending' }
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({
      success: false,
      message: '대기 중인 이미지 개수 조회 실패',
      error: error.message
    });
  }
};

/**
 * 이미지 프록시 (CORS 우회용)
 * - S3 URL을 받아서 이미지 바이너리를 반환
 * - ZIP 다운로드 기능에서 사용
 */
exports.proxyImage = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL이 필요합니다'
      });
    }

    // S3 URL 검증 (보안)
    const allowedDomains = [
      'campmanager-review-images.s3.ap-northeast-2.amazonaws.com',
      's3.ap-northeast-2.amazonaws.com'
    ];

    const urlObj = new URL(url);
    const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: '허용되지 않은 URL입니다'
      });
    }

    // S3에서 이미지 fetch
    const https = require('https');
    const http = require('http');
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (imageRes) => {
      if (imageRes.statusCode !== 200) {
        return res.status(imageRes.statusCode).json({
          success: false,
          message: '이미지를 가져올 수 없습니다'
        });
      }

      // Content-Type 전달
      const contentType = imageRes.headers['content-type'] || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // 이미지 스트림 전달
      imageRes.pipe(res);
    }).on('error', (err) => {
      console.error('Proxy image fetch error:', err);
      res.status(500).json({
        success: false,
        message: '이미지 프록시 실패',
        error: err.message
      });
    });
  } catch (error) {
    console.error('Proxy image error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 프록시 실패',
      error: error.message
    });
  }
};
