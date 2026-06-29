const { BloggerRequestItem, BloggerRequest, Blogger, Campaign } = require('../models');
const { notifyAllAdmins } = require('./notificationController');

/**
 * 공개 제출 컨텍스트 조회 (Public, 토큰)
 * 블로거에게 보여줄 최소 정보만 반환 (브랜드 연락처/계좌 등 민감정보 제외)
 */
exports.getByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const item = await BloggerRequestItem.findOne({
      where: { submit_token: token },
      include: [
        { model: Blogger, as: 'blogger', attributes: ['id', 'activity_name'] },
        {
          model: BloggerRequest,
          as: 'request',
          attributes: ['id', 'product_provision', 'guide_text'],
          include: [{ model: Campaign, as: 'campaign', attributes: ['id', 'name'] }]
        }
      ]
    });

    if (!item) {
      return res.status(404).json({ success: false, message: '유효하지 않은 제출 링크입니다' });
    }

    res.json({
      success: true,
      data: {
        activity_name: item.blogger?.activity_name || '',
        campaign_name: item.request?.campaign?.name || null,
        product_provision: item.product_provision || item.request?.product_provision || null,
        guide_text: item.request?.guide_text || null,
        submission_url: item.submission_url || null,
        submitted_at: item.submitted_at || null
      }
    });
  } catch (error) {
    console.error('getByToken error:', error);
    res.status(500).json({ success: false, message: '제출 정보 조회에 실패했습니다' });
  }
};

/**
 * 작성 링크 제출 (Public, 토큰)
 * body: { url }
 */
exports.submit = async (req, res) => {
  try {
    const { token } = req.params;
    const { url } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, message: '작성한 블로그 글 링크를 입력해주세요' });
    }

    const item = await BloggerRequestItem.findOne({ where: { submit_token: token } });
    if (!item) {
      return res.status(404).json({ success: false, message: '유효하지 않은 제출 링크입니다' });
    }

    await item.update({
      submission_url: url.trim(),
      submitted_at: new Date()
    });

    // admin 알림
    try {
      const blogger = await Blogger.findByPk(item.blogger_id, { attributes: ['activity_name'] });
      await notifyAllAdmins(
        'target_reached',
        '블로거 작성 링크 제출',
        `${blogger?.activity_name || '블로거'}님이 작성한 블로그 링크를 제출했습니다.`,
        'blogger_request',
        item.request_id
      );
    } catch (e) { /* 무시 */ }

    res.json({ success: true });
  } catch (error) {
    console.error('submit error:', error);
    res.status(500).json({ success: false, message: '링크 제출에 실패했습니다' });
  }
};
