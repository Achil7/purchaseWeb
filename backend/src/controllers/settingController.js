const { Setting } = require('../models');
const { uploadToS3, deleteFromS3 } = require('../config/s3');

/**
 * 로그인 페이지 설정 조회 (Public)
 */
exports.getLoginSettings = async (req, res) => {
  try {
    const settings = await Setting.findAll({
      where: {
        key: ['login_title', 'login_subtitle', 'login_banner_image', 'login_announcement', 'banner_title', 'banner_subtitle']
      }
    });

    const result = {};
    settings.forEach(s => {
      result[s.key] = s.value;
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get login settings error:', error);
    res.status(500).json({
      success: false,
      message: '설정 조회 실패',
      error: error.message
    });
  }
};

/**
 * 로그인 페이지 설정 수정 (Admin only)
 */
exports.updateLoginSettings = async (req, res) => {
  try {
    const { login_title, login_subtitle, login_announcement, banner_title, banner_subtitle } = req.body;
    const userId = req.user.id;

    // 로그인 폼 제목 업데이트
    if (login_title !== undefined) {
      await Setting.upsert({
        key: 'login_title',
        value: login_title,
        updated_by: userId,
        updated_at: new Date()
      });
    }

    // 로그인 폼 부제목 업데이트
    if (login_subtitle !== undefined) {
      await Setting.upsert({
        key: 'login_subtitle',
        value: login_subtitle,
        updated_by: userId,
        updated_at: new Date()
      });
    }

    // 배너 제목 업데이트
    if (banner_title !== undefined) {
      await Setting.upsert({
        key: 'banner_title',
        value: banner_title,
        updated_by: userId,
        updated_at: new Date()
      });
    }

    // 배너 부제목 업데이트
    if (banner_subtitle !== undefined) {
      await Setting.upsert({
        key: 'banner_subtitle',
        value: banner_subtitle,
        updated_by: userId,
        updated_at: new Date()
      });
    }

    // 공지사항 업데이트
    if (login_announcement !== undefined) {
      await Setting.upsert({
        key: 'login_announcement',
        value: login_announcement,
        updated_by: userId,
        updated_at: new Date()
      });
    }

    res.json({
      success: true,
      message: '설정이 저장되었습니다'
    });
  } catch (error) {
    console.error('Update login settings error:', error);
    res.status(500).json({
      success: false,
      message: '설정 저장 실패',
      error: error.message
    });
  }
};

/**
 * 로그인 배너 이미지 업로드 (Admin only)
 */
exports.uploadLoginBanner = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다'
      });
    }

    // 기존 이미지 삭제
    const existingSetting = await Setting.findOne({
      where: { key: 'login_banner_image' }
    });

    if (existingSetting && existingSetting.value) {
      try {
        // S3 URL에서 key 추출
        const oldKey = existingSetting.value.split('.com/')[1];
        if (oldKey) {
          await deleteFromS3(oldKey);
        }
      } catch (deleteErr) {
        console.error('Failed to delete old banner:', deleteErr);
      }
    }

    // 새 이미지 업로드
    const timestamp = Date.now();
    const s3Key = `settings/login_banner_${timestamp}_${req.file.originalname}`;
    const s3Url = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);

    // DB 업데이트
    await Setting.upsert({
      key: 'login_banner_image',
      value: s3Url,
      updated_by: userId,
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: '배너 이미지가 업로드되었습니다',
      data: { url: s3Url }
    });
  } catch (error) {
    console.error('Upload login banner error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드 실패',
      error: error.message
    });
  }
};

/**
 * 로그인 배너 이미지 삭제 (Admin only)
 */
exports.deleteLoginBanner = async (req, res) => {
  try {
    const userId = req.user.id;

    const existingSetting = await Setting.findOne({
      where: { key: 'login_banner_image' }
    });

    if (existingSetting && existingSetting.value) {
      try {
        const oldKey = existingSetting.value.split('.com/')[1];
        if (oldKey) {
          await deleteFromS3(oldKey);
        }
      } catch (deleteErr) {
        console.error('Failed to delete banner:', deleteErr);
      }
    }

    await Setting.upsert({
      key: 'login_banner_image',
      value: null,
      updated_by: userId,
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: '배너 이미지가 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete login banner error:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제 실패',
      error: error.message
    });
  }
};
