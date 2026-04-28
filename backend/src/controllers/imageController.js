const { Item, Image, Campaign, Buyer, ItemSlot, MonthlyBrand } = require('../models');
const { sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;
const { uploadToS3, deleteFromS3 } = require('../config/s3');
const multer = require('multer');
const { normalizeAccountNumber } = require('../utils/accountNormalizer');
const { createNotification } = require('./notificationController');
const { getNextBusinessDay, formatDateToYYYYMMDD } = require('../utils/dateUtils');
const { v4: uuidv4 } = require('uuid');
const { extractForBuyerAsync } = require('../services/imageExtractor');

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

    // 해당 day_group 내 구매자만 조회 (승인된 이미지 정보 포함)
    const allBuyers = await Buyer.findAll({
      where: {
        id: { [Op.in]: slotBuyerIds },  // day_group 내 구매자만
        is_temporary: false
      },
      include: [{
        model: Image,
        as: 'images',
        where: { status: 'approved' },  // pending 상태의 재제출 이미지는 제외
        required: false,
        attributes: ['id', 's3_url', 'file_name']
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

    // 결과 포맷 (hasImage 플래그 + 이미지 목록 포함)
    const result = matchedBuyers.map(buyer => ({
      id: buyer.id,
      order_number: buyer.order_number || '',
      deposit_name: buyer.deposit_name || '',
      buyer_name: buyer.buyer_name || '',
      recipient_name: buyer.recipient_name || '',
      user_id: buyer.user_id || '',
      hasImage: buyer.images && buyer.images.length > 0,
      images: (buyer.images || []).map(img => ({
        id: img.id,
        s3_url: img.s3_url,
        file_name: img.file_name
      })),
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
  // 27차: 트랜잭션을 S3 업로드 이후로 이동 (커넥션 점유 시간 단축)
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
      return res.status(400).json({
        success: false,
        message: '구매자를 선택해주세요'
      });
    }

    // 파일 확인
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다'
      });
    }

    // buyerIds와 files 개수가 동일해야 함 (1:1 매핑이지만, 같은 buyerId 중복 가능)
    if (buyerIds.length !== req.files.length) {
      return res.status(400).json({
        success: false,
        message: `구매자 ID 수(${buyerIds.length})와 이미지 수(${req.files.length})가 일치하지 않습니다`
      });
    }

    // 토큰으로 품목 조회 (ItemSlot 토큰) — 트랜잭션 밖
    const slot = await ItemSlot.findOne({
      where: { upload_link_token: token },
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Campaign, as: 'campaign' }]
      }]
    });

    if (!slot || !slot.item) {
      return res.status(404).json({
        success: false,
        message: '유효하지 않은 업로드 링크입니다'
      });
    }

    const item = slot.item;

    // 선택된 구매자들 조회 및 검증 (중복 제거한 unique buyer_id 목록) — 트랜잭션 밖
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
        where: { status: 'approved' },  // 승인된 이미지만 체크 (재제출 여부 판단용)
        required: false,
        attributes: ['id']
      }]
    });

    // 모든 unique buyer_id가 유효한지 확인 (같은 구매자에 여러 이미지 가능)
    if (buyers.length !== uniqueBuyerIds.length) {
      return res.status(400).json({
        success: false,
        message: '일부 구매자를 찾을 수 없습니다'
      });
    }

    // buyer_id 순서대로 매핑 생성
    const buyerMap = {};
    buyers.forEach(b => { buyerMap[b.id] = b; });

    // 다중 이미지 업로드 - buyer_ids[i] ↔ files[i] 매칭
    const uploadedImages = [];
    const resubmittedImages = [];

    // 재제출 그룹 ID 생성 (같은 구매자가 한번에 재제출한 이미지들을 그룹화)
    // 구매자별로 그룹 ID 할당
    const buyerResubmissionGroups = {};
    for (const buyerId of uniqueBuyerIds) {
      const buyer = buyerMap[buyerId];
      if (buyer && buyer.images && buyer.images.length > 0) {
        // 재제출인 경우 그룹 ID 생성
        buyerResubmissionGroups[buyerId] = uuidv4();
      }
    }

    // 27차: S3 업로드를 트랜잭션 밖에서 실행 (DB 커넥션 점유 안 함)
    const s3Results = await Promise.all(req.files.map((file, i) => {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const s3Key = `uploads/${item.id}/${timestamp}_${i}_${randomSuffix}_${file.originalname}`;
      return uploadToS3(file.buffer, s3Key, file.mimetype).then(s3Url => ({ s3Key, s3Url, file, buyerId: buyerIds[i] }));
    }));

    // 27차: S3 완료 후에만 짧은 DB 트랜잭션 시작
    const transaction = await sequelize.transaction();

    try {
    for (const { s3Key, s3Url, file, buyerId } of s3Results) {
      const targetBuyer = buyerMap[buyerId];

      if (!targetBuyer) {
        continue;
      }

      // 기존 이미지가 있는지 확인 (재제출 여부)
      const hasExistingImage = targetBuyer.images && targetBuyer.images.length > 0;
      const previousImageId = hasExistingImage ? targetBuyer.images[0].id : null;

      // 입금 확인 여부 확인 (재제출 시 중요) — 이미 조회한 buyer 데이터 재사용 (N+1 제거)
      const isPaymentConfirmed = targetBuyer.payment_status === 'completed';

      // DB에 이미지 레코드 생성
      // 재제출인 경우: 무조건 status='pending', previous_image_id 설정 (승인 필요)
      // 신규인 경우: status='approved' (기본값)
      const resubmissionGroupId = hasExistingImage ? buyerResubmissionGroups[targetBuyer.id] : null;

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
        previous_image_id: previousImageId,
        resubmission_group_id: resubmissionGroupId
      }, { transaction });

      // 입금 예정일 업데이트:
      // - 입금 확인됨: 절대 업데이트하지 않음 (날짜별 입금관리에 영향 없음)
      // - 재제출(hasExistingImage): 기존 expected_payment_date 유지 (날짜 이동 방지)
      // - 신규 업로드만 expected_payment_date 설정
      if (!isPaymentConfirmed && !hasExistingImage) {
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
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

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

    // 리뷰 텍스트 추출 트리거 (신규 approved 업로드만)
    // - 재제출(pending)은 승인 시 approveImage에서 처리
    // - fire-and-forget: 에러는 내부에서 처리, 응답에 영향 없음
    if (uploadedImages.length > 0) {
      const newBuyerIds = [...new Set(uploadedImages.map(img => img.buyer_id))];
      for (const buyerId of newBuyerIds) {
        extractForBuyerAsync(buyerId);
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

    // DB에서 이미지 삭제 (hard-delete)
    await image.destroy({ transaction, force: true });

    // Buyer의 리뷰 관련 필드 초기화
    if (buyerId) {
      // 해당 Buyer에 다른 이미지가 남아있는지 확인
      const remainingImages = await Image.count({
        where: { buyer_id: buyerId },
        transaction
      });

      // 다른 이미지가 없으면 리뷰 관련 필드 초기화
      if (remainingImages === 0) {
        // 입금 확인된 구매자는 리뷰 관련 필드를 초기화하지 않음 (날짜별 입금관리에 영향 없음)
        const buyerRecord = await Buyer.findByPk(buyerId, { transaction });
        if (buyerRecord && buyerRecord.payment_status !== 'completed') {
          await Buyer.update({
            review_submitted_at: null,
            expected_payment_date: null
          }, {
            where: { id: buyerId },
            transaction
          });
        }

        // ItemSlot의 status를 'active'로 복원 (입금 여부 관계없이)
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
 * - 그룹별로 묶어서 반환 (같은 resubmission_group_id를 가진 이미지들)
 */
exports.getPendingImages = async (req, res) => {
  try {
    const images = await Image.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: Buyer,
          as: 'buyer',
          attributes: ['id', 'buyer_name', 'recipient_name', 'order_number', 'payment_status']
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
        }
      ],
      order: [['resubmission_group_id', 'ASC'], ['resubmitted_at', 'DESC']]
    });

    // 그룹별로 묶기 + 해당 구매자의 기존 이미지들도 함께 조회
    const groupedData = [];
    const processedGroups = new Set();
    const processedBuyers = new Set();

    for (const image of images) {
      const groupId = image.resubmission_group_id;
      const buyerId = image.buyer_id;

      // 그룹 ID가 있고 이미 처리한 그룹이면 스킵
      if (groupId && processedGroups.has(groupId)) {
        continue;
      }

      // 그룹 ID가 없고 이미 처리한 구매자면 스킵
      if (!groupId && processedBuyers.has(buyerId)) {
        continue;
      }

      // 같은 그룹의 모든 새 이미지들
      let newImages = [image];
      if (groupId) {
        newImages = images.filter(img => img.resubmission_group_id === groupId);
        processedGroups.add(groupId);
      } else {
        processedBuyers.add(buyerId);
      }

      // 해당 구매자의 기존 승인된 이미지들 조회
      const existingImages = await Image.findAll({
        where: {
          buyer_id: buyerId,
          status: 'approved'
        },
        attributes: ['id', 's3_url', 'file_name', 'created_at'],
        order: [['created_at', 'ASC']]
      });

      groupedData.push({
        groupId: groupId || `single_${image.id}`,
        buyer: image.buyer,
        item: image.item,
        resubmittedAt: image.resubmitted_at,
        newImages: newImages.map(img => ({
          id: img.id,
          s3_url: img.s3_url,
          file_name: img.file_name,
          resubmitted_at: img.resubmitted_at
        })),
        existingImages: existingImages.map(img => ({
          id: img.id,
          s3_url: img.s3_url,
          file_name: img.file_name,
          created_at: img.created_at
        })),
        isPaymentConfirmed: image.buyer?.payment_status === 'completed'
      });
    }

    res.json({
      success: true,
      data: groupedData,
      count: groupedData.length
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
 * - 그룹 단위 승인: 같은 resubmission_group_id를 가진 이미지들을 한번에 승인
 * - 해당 구매자의 모든 기존 이미지 삭제 (S3 + DB)
 * - 새 이미지들 status를 'approved'로 변경
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

    // 그룹 단위 승인: 같은 resubmission_group_id를 가진 모든 이미지 조회
    let imagesToApprove = [image];
    if (image.resubmission_group_id) {
      imagesToApprove = await Image.findAll({
        where: {
          resubmission_group_id: image.resubmission_group_id,
          status: 'pending'
        },
        include: [{ model: Buyer, as: 'buyer' }],
        transaction
      });
    }

    // 승인할 이미지들의 ID 목록
    const approveImageIds = imagesToApprove.map(img => img.id);

    // 해당 구매자의 모든 기존 이미지 삭제 (현재 승인하는 이미지들 제외)
    const existingImages = await Image.findAll({
      where: {
        buyer_id: image.buyer_id,
        id: { [Op.notIn]: approveImageIds },  // 현재 승인하는 이미지들 제외
        status: 'approved'  // 기존 승인된 이미지만
      },
      transaction
    });

    // 기존 이미지들 S3 및 DB에서 삭제
    for (const oldImage of existingImages) {
      try {
        await deleteFromS3(oldImage.s3_key);
      } catch (s3Error) {
        console.error('S3 delete old image error:', s3Error);
      }
      await oldImage.destroy({ transaction });
    }

    // 그룹 내 모든 새 이미지 승인
    for (const img of imagesToApprove) {
      await img.update({
        status: 'approved',
        previous_image_id: null,
        resubmission_group_id: null  // 승인 후 그룹 ID 제거
      }, { transaction });
    }

    // 입금 예정일 업데이트 (재제출 승인 시점 기준)
    // - 입금 확인됨: 절대 업데이트하지 않음
    // - 이미 expected_payment_date가 있으면 유지 (재제출 승인 시 날짜 이동 방지)
    if (image.buyer) {
      const isPaymentConfirmed = image.buyer.payment_status === 'completed';

      if (!isPaymentConfirmed) {
        const buyerRecord = await Buyer.findByPk(image.buyer.id, { transaction });
        // expected_payment_date가 없을 때만 설정 (기존 날짜 보호)
        if (!buyerRecord.expected_payment_date) {
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

    // 재제출 승인 완료 → 해당 구매자의 리뷰 텍스트 재추출 (force=true)
    // 기존 이미지가 교체되었으므로 새 이미지 기준으로 다시 추출
    if (image.buyer_id) {
      extractForBuyerAsync(image.buyer_id, { force: true });
    }

    res.json({
      success: true,
      message: `${imagesToApprove.length}개의 이미지가 승인되었습니다`,
      approvedCount: imagesToApprove.length
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
 * - 그룹 단위 거절: 같은 resubmission_group_id를 가진 이미지들을 한번에 거절
 * - 새 이미지들 삭제 (S3 + DB)
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

    // 그룹 단위 거절: 같은 resubmission_group_id를 가진 모든 이미지 조회
    let imagesToReject = [image];
    if (image.resubmission_group_id) {
      imagesToReject = await Image.findAll({
        where: {
          resubmission_group_id: image.resubmission_group_id,
          status: 'pending'
        },
        transaction
      });
    }

    // 그룹 내 모든 새 이미지 S3 및 DB에서 삭제
    for (const img of imagesToReject) {
      try {
        await deleteFromS3(img.s3_key);
      } catch (s3Error) {
        console.error('S3 delete rejected image error:', s3Error);
      }
      await img.destroy({ transaction });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: `${imagesToReject.length}개의 이미지가 거절되었습니다`,
      rejectedCount: imagesToReject.length
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

/**
 * 리뷰샷 검색 (Admin 전용)
 * - 모든 필터(브랜드사/제품명/기간/예금주) 선택, 단 최소 1개 이상 필수
 * - approved 상태만 (pending/rejected 제외)
 * - 예금주 필터 사용 시 선 업로드(is_temporary=true) 제외
 */
exports.searchImages = async (req, res) => {
  try {
    const { brand_id, product_name, start_date, end_date, account_holder, platform } = req.query;
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 100;
    if (limit > 500) limit = 500;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const brandIdNum = brand_id ? parseInt(brand_id, 10) : null;
    const productNameTrimmed = product_name && product_name.trim() ? product_name.trim() : null;
    const accountHolderTrimmed = account_holder && account_holder.trim() ? account_holder.trim() : null;
    const platformTrimmed = platform && platform.trim() ? platform.trim() : null;
    const hasAnyFilter = brandIdNum || productNameTrimmed || start_date || end_date || accountHolderTrimmed || platformTrimmed;

    if (!hasAnyFilter) {
      return res.status(400).json({
        success: false,
        message: '최소 1개 이상의 검색 조건을 입력해주세요'
      });
    }

    const imageWhere = { status: 'approved' };
    if (start_date || end_date) {
      imageWhere.created_at = {};
      if (start_date) imageWhere.created_at[Op.gte] = new Date(start_date);
      if (end_date) {
        const end = new Date(end_date);
        end.setHours(23, 59, 59, 999);
        imageWhere.created_at[Op.lte] = end;
      }
    }

    const itemWhere = {};
    if (productNameTrimmed) {
      itemWhere.product_name = { [Op.iLike]: `%${productNameTrimmed}%` };
    }

    // 플랫폼은 ItemSlot.platform에 day_group별로 저장됨 (Item.platform은 placeholder).
    // image.upload_token ↔ item_slots.upload_link_token으로 매칭하는 EXISTS 서브쿼리 사용.
    if (platformTrimmed) {
      const escaped = platformTrimmed.replace(/'/g, "''");
      imageWhere[Op.and] = imageWhere[Op.and] || [];
      imageWhere[Op.and].push(
        Sequelize.literal(
          `EXISTS (SELECT 1 FROM item_slots s WHERE s.upload_link_token = "Image"."upload_token" AND s.platform ILIKE '%${escaped}%')`
        )
      );
    }

    const buyerWhere = {};
    if (accountHolderTrimmed) {
      buyerWhere.account_info = { [Op.iLike]: `%${accountHolderTrimmed}%` };
      buyerWhere.is_temporary = false;
    }
    const buyerRequired = accountHolderTrimmed ? true : false;

    const { count, rows } = await Image.findAndCountAll({
      where: imageWhere,
      include: [
        {
          model: Buyer,
          as: 'buyer',
          required: buyerRequired,
          where: Object.keys(buyerWhere).length > 0 ? buyerWhere : undefined,
          attributes: ['id', 'buyer_name', 'recipient_name', 'order_number', 'is_temporary']
        },
        {
          model: Item,
          as: 'item',
          required: true,
          attributes: ['id', 'product_name'],
          where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
          include: [{
            model: Campaign,
            as: 'campaign',
            required: true,
            attributes: ['id', 'name', 'monthly_brand_id'],
            where: brandIdNum ? { brand_id: brandIdNum } : undefined,
            include: [{
              model: MonthlyBrand,
              as: 'monthlyBrand',
              required: false,
              attributes: ['id', 'name', 'year_month']
            }]
          }]
        }
      ],
      // 같은 구매자 이미지를 연속으로 묶어 반환 (buyer_id 없는 선 업로드는 맨 뒤)
      order: [
        [Sequelize.literal('CASE WHEN "Image"."buyer_id" IS NULL THEN 1 ELSE 0 END'), 'ASC'],
        ['buyer_id', 'ASC'],
        ['created_at', 'ASC']
      ],
      limit,
      offset,
      subQuery: false,
      distinct: true,
      col: 'id'
    });

    const images = rows.map(img => ({
      id: img.id,
      s3_url: img.s3_url,
      file_name: img.file_name,
      created_at: img.created_at,
      buyer: img.buyer ? {
        id: img.buyer.id,
        buyer_name: img.buyer.buyer_name,
        recipient_name: img.buyer.recipient_name,
        order_number: img.buyer.order_number,
        is_temporary: img.buyer.is_temporary
      } : null,
      item: img.item ? {
        id: img.item.id,
        product_name: img.item.product_name
      } : null,
      campaign: img.item?.campaign ? {
        id: img.item.campaign.id,
        name: img.item.campaign.name
      } : null,
      monthly_brand: img.item?.campaign?.monthlyBrand ? {
        id: img.item.campaign.monthlyBrand.id,
        name: img.item.campaign.monthlyBrand.name,
        year_month: img.item.campaign.monthlyBrand.year_month
      } : null
    }));

    res.json({
      success: true,
      total: count,
      limit,
      offset,
      data: images
    });
  } catch (error) {
    console.error('Search images error:', error);
    res.status(500).json({
      success: false,
      message: '리뷰샷 검색 실패',
      error: error.message
    });
  }
};
