const { Item, Image, Campaign, Buyer, ItemSlot } = require('../models');
const { sequelize } = require('../models');
const { uploadToS3, deleteFromS3 } = require('../config/s3');
const multer = require('multer');
const { normalizeAccountNumber } = require('../utils/accountNormalizer');
const { createNotification } = require('./notificationController');

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

// multer 미들웨어 export - 다중 파일 지원 (최대 10개)
exports.uploadMiddleware = upload.array('images', 10);

/**
 * 다중 이미지 업로드 (주문번호 또는 계좌번호 매칭)
 * - 주문번호 또는 계좌번호로 구매자 매칭 (1 구매자 = 1 이미지)
 * - 같은 식별자의 구매자가 N명이면 N개 이미지까지 각각 1:1 매칭
 */
exports.uploadImages = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token } = req.params;
    const { account_number, order_number, is_slot_upload } = req.body;

    // 토큰으로 품목 조회 (Item 토큰 먼저, 없으면 ItemSlot 토큰 시도)
    let item = await Item.findOne({
      where: { upload_link_token: token },
      include: [{ model: Campaign, as: 'campaign' }],
      transaction
    });

    // Item 토큰으로 찾지 못하면 ItemSlot 토큰으로 시도
    if (!item) {
      const slot = await ItemSlot.findOne({
        where: { upload_link_token: token },
        include: [{
          model: Item,
          as: 'item',
          include: [{ model: Campaign, as: 'campaign' }]
        }],
        transaction
      });

      if (slot && slot.item) {
        item = slot.item;
      }
    }

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '유효하지 않은 업로드 링크입니다'
      });
    }

    // 주문번호 또는 계좌번호 중 하나는 필수
    if (!order_number && !account_number) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '주문번호 또는 계좌번호 중 하나를 입력해주세요'
      });
    }

    // 계좌번호 정규화 (입력된 경우에만)
    let accountNormalized = null;
    if (account_number) {
      accountNormalized = normalizeAccountNumber(account_number);
      // 계좌번호가 입력되었지만 형식이 잘못된 경우 (주문번호가 없을 때만 에러)
      if (!accountNormalized && !order_number) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: '올바른 계좌번호 형식이 아닙니다. 숫자가 8자리 이상 포함되어야 합니다.'
        });
      }
    }

    // 주문번호 정규화 (공백 제거)
    const orderNumberNormalized = order_number ? order_number.trim() : null;

    // 파일 확인
    if (!req.files || req.files.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다'
      });
    }

    // 모든 정상 구매자 조회
    const allBuyersInItem = await Buyer.findAll({
      where: {
        item_id: item.id,
        is_temporary: false
      },
      include: [{
        model: Image,
        as: 'images',
        attributes: ['id']
      }],
      order: [['created_at', 'ASC']],
      transaction
    });

    console.log(`[Upload] Looking for order: ${orderNumberNormalized}, account: ${accountNormalized}`);
    console.log(`[Upload] Total buyers in item: ${allBuyersInItem.length}`);

    // 구매자 매칭 (주문번호 우선, 없으면 계좌번호로)
    const availableBuyers = allBuyersInItem.filter(buyer => {
      // 주문번호로 매칭 (우선순위 높음)
      if (orderNumberNormalized && buyer.order_number) {
        const buyerOrderNorm = buyer.order_number.trim();
        if (buyerOrderNorm === orderNumberNormalized) {
          console.log(`[Upload] Buyer ${buyer.id}: matched by order_number "${buyerOrderNorm}"`);
          return true;
        }
      }

      // 계좌번호로 매칭
      if (accountNormalized) {
        let buyerAccountNorm = buyer.account_normalized;
        if (!buyerAccountNorm && buyer.account_info) {
          buyerAccountNorm = normalizeAccountNumber(buyer.account_info);
        }
        if (buyerAccountNorm === accountNormalized) {
          console.log(`[Upload] Buyer ${buyer.id}: matched by account "${buyerAccountNorm}"`);
          return true;
        }
      }

      return false;
    });

    // 이미지가 없는 구매자만 필터링
    const buyersWithoutImage = availableBuyers.filter(b => !b.images || b.images.length === 0);

    // 등록된 구매자가 없으면 에러 반환
    if (availableBuyers.length === 0) {
      await transaction.rollback();
      const identifier = orderNumberNormalized ? `주문번호 "${orderNumberNormalized}"` : `계좌번호 "${account_number}"`;
      return res.status(400).json({
        success: false,
        message: `${identifier}에 해당하는 구매자가 없습니다. 먼저 구매자 정보를 등록해주세요.`,
        code: 'BUYER_NOT_FOUND'
      });
    }

    // 이미지를 업로드할 수 있는 구매자가 없으면 에러 반환
    if (buyersWithoutImage.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '해당 구매자에게 이미 이미지가 등록되어 있습니다.',
        code: 'ALL_BUYERS_HAVE_IMAGE'
      });
    }

    // 업로드하려는 이미지 수가 매칭 가능한 구매자 수보다 많으면 에러
    if (req.files.length > buyersWithoutImage.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `업로드 가능한 이미지 수를 초과했습니다. 등록된 구매자: ${buyersWithoutImage.length}명, 업로드 시도: ${req.files.length}개`,
        code: 'EXCEED_REGISTERED_COUNT'
      });
    }

    // 다중 이미지 업로드 - 각 이미지를 개별 구매자에 매칭
    const uploadedImages = [];
    let buyerIndex = 0;

    for (const file of req.files) {
      const targetBuyer = buyersWithoutImage[buyerIndex];
      buyerIndex++;

      // 구매자의 account_normalized가 없으면 업데이트
      if (accountNormalized && !targetBuyer.account_normalized) {
        await targetBuyer.update({ account_normalized: accountNormalized }, { transaction });
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const s3Key = `uploads/${item.id}/${timestamp}_${randomSuffix}_${file.originalname}`;

      // S3에 업로드
      const s3Url = await uploadToS3(file.buffer, s3Key, file.mimetype);

      // DB에 이미지 레코드 생성
      const image = await Image.create({
        item_id: item.id,
        buyer_id: targetBuyer.id,
        account_normalized: accountNormalized,
        file_name: file.originalname,
        file_path: s3Key,
        s3_key: s3Key,
        s3_url: s3Url,
        file_size: file.size,
        mime_type: file.mimetype,
        upload_token: token,
        uploaded_by_ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
      }, { transaction });

      uploadedImages.push(image.toJSON());
    }

    await transaction.commit();

    // 타겟 달성 체크 및 브랜드 알림
    try {
      // 현재 품목의 이미지 개수 (완료된 리뷰 수) 조회
      const completedCount = await Image.count({ where: { item_id: item.id } });
      const targetCount = item.total_purchase_count || 0;

      // 이번 업로드로 타겟 달성한 경우에만 알림
      const previousCount = completedCount - uploadedImages.length;
      if (targetCount > 0 && previousCount < targetCount && completedCount >= targetCount) {
        // 캠페인의 브랜드 사용자에게 알림
        // campaign이 이미 include 되어 있으면 사용, 아니면 새로 조회
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
      // 알림 실패해도 업로드는 성공으로 처리
    }

    res.status(201).json({
      success: true,
      message: `${uploadedImages.length}개의 이미지가 업로드되었습니다.`,
      data: uploadedImages.map(img => ({
        id: img.id,
        s3_url: img.s3_url
      })),
      totalUploaded: uploadedImages.length
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
 * 이미지 삭제
 */
exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await Image.findByPk(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다'
      });
    }

    // S3에서 삭제
    try {
      await deleteFromS3(image.s3_key);
    } catch (s3Error) {
      console.error('S3 delete error:', s3Error);
      // S3 삭제 실패해도 DB 레코드는 삭제 진행
    }

    // DB에서 삭제
    await image.destroy();

    res.json({
      success: true,
      message: '이미지가 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제 실패',
      error: error.message
    });
  }
};
