const { Item, Image, Campaign } = require('../models');
const { uploadToS3, deleteFromS3 } = require('../config/s3');
const multer = require('multer');

// multer 설정 - 메모리 스토리지 사용 (S3로 직접 업로드)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
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

// multer 미들웨어 export
exports.uploadMiddleware = upload.single('image');

/**
 * 이미지 업로드 (토큰 기반 - Public)
 */
exports.uploadImage = async (req, res) => {
  try {
    const { token } = req.params;
    const { order_number } = req.body;

    // 토큰으로 품목 조회
    const item = await Item.findOne({
      where: { upload_link_token: token },
      include: [{ model: Campaign, as: 'campaign' }]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '유효하지 않은 업로드 링크입니다'
      });
    }

    // 파일 확인
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다'
      });
    }

    const file = req.file;
    const timestamp = Date.now();
    const fileExtension = file.originalname.split('.').pop();
    const s3Key = `uploads/${item.id}/${timestamp}_${file.originalname}`;

    // S3에 업로드
    const s3Url = await uploadToS3(file.buffer, s3Key, file.mimetype);

    // DB에 이미지 레코드 생성
    const image = await Image.create({
      item_id: item.id,
      order_number: order_number || null,
      file_name: file.originalname,
      file_path: s3Key,
      s3_key: s3Key,
      s3_url: s3Url,
      file_size: file.size,
      mime_type: file.mimetype,
      upload_token: token,
      uploaded_by_ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    });

    res.status(201).json({
      success: true,
      message: '이미지가 업로드되었습니다',
      data: {
        id: image.id,
        s3_url: s3Url,
        order_number: order_number
      }
    });
  } catch (error) {
    console.error('Upload image error:', error);
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
      attributes: ['id', 's3_url', 'file_name', 'order_number', 'created_at', 'file_size']
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
