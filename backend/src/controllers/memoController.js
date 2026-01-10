const { UserMemo } = require('../models');

// 내 메모 조회
exports.getMyMemo = async (req, res) => {
  try {
    const userId = req.user.id;

    let memo = await UserMemo.findOne({
      where: { user_id: userId }
    });

    // 메모가 없으면 빈 메모 반환
    if (!memo) {
      memo = { content: '' };
    }

    res.json({
      success: true,
      data: memo
    });
  } catch (error) {
    console.error('Get memo error:', error);
    res.status(500).json({
      success: false,
      message: '메모 조회 실패',
      error: error.message
    });
  }
};

// 내 메모 저장 (생성 또는 업데이트)
exports.saveMyMemo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content } = req.body;

    // 기존 메모 찾기
    let memo = await UserMemo.findOne({
      where: { user_id: userId }
    });

    if (memo) {
      // 있으면 업데이트
      await memo.update({ content: content || '' });
    } else {
      // 없으면 생성
      memo = await UserMemo.create({
        user_id: userId,
        content: content || ''
      });
    }

    res.json({
      success: true,
      message: '메모가 저장되었습니다.',
      data: memo
    });
  } catch (error) {
    console.error('Save memo error:', error);
    res.status(500).json({
      success: false,
      message: '메모 저장 실패',
      error: error.message
    });
  }
};
