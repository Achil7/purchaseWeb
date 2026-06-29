const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { BloggerRequest, BloggerRequestItem, Blogger, Campaign, User } = require('../models');
const { createNotification, notifyAllAdmins } = require('./notificationController');

// 요청에 포함할 표준 include (항목 + 블로거 + 캠페인)
const requestInclude = [
  {
    model: BloggerRequestItem,
    as: 'items',
    include: [{ model: Blogger, as: 'blogger', attributes: ['id', 'activity_name', 'blog_url', 'daily_visitors', 'main_content'] }]
  },
  { model: Campaign, as: 'campaign', attributes: ['id', 'name'] }
];

/**
 * 브랜드 ID 해석 (brand: 본인, admin: body.brand_id 또는 viewAsUserId)
 */
function resolveBrandId(req) {
  if (req.user.role === 'brand') return req.user.id;
  if (req.user.role === 'admin') {
    const v = req.body?.brand_id || req.query?.viewAsUserId;
    return v ? parseInt(v, 10) : null;
  }
  return null;
}

/**
 * 협의 요청 생성 (brand, admin)
 * body: { blogger_ids: [], campaign_id?, product_provision?, brand_memo? }
 */
exports.createRequest = async (req, res) => {
  try {
    const brandId = resolveBrandId(req);
    if (!brandId) {
      return res.status(400).json({ success: false, message: '브랜드 정보를 확인할 수 없습니다 (admin은 brand_id 필요)' });
    }

    const { blogger_ids, campaign_id, product_provision, brand_memo } = req.body;
    if (!Array.isArray(blogger_ids) || blogger_ids.length === 0) {
      return res.status(400).json({ success: false, message: '선택된 블로거가 없습니다' });
    }

    // 실제 존재하는(노출중) 블로거만 필터
    const bloggers = await Blogger.findAll({
      where: { id: { [Op.in]: blogger_ids }, is_active: true },
      attributes: ['id']
    });
    const validIds = bloggers.map(b => b.id);
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: '유효한 블로거가 없습니다' });
    }

    const request = await BloggerRequest.create({
      brand_id: brandId,
      campaign_id: campaign_id || null,
      status: 'requested',
      product_provision: product_provision || null,
      brand_memo: brand_memo || null,
      created_by: req.user.id
    });

    await BloggerRequestItem.bulkCreate(
      validIds.map(bid => ({
        request_id: request.id,
        blogger_id: bid,
        participation_status: 'pending',
        product_provision: product_provision || null
      }))
    );

    // admin 알림
    try {
      const brandUser = await User.findByPk(brandId, { attributes: ['name', 'username'] });
      const brandName = brandUser?.name || brandUser?.username || '브랜드사';
      await notifyAllAdmins(
        'campaign_created',
        '블로거 협의 요청',
        `${brandName}님이 블로거 ${validIds.length}명에 대한 협의를 요청했습니다.`,
        'blogger_request',
        request.id
      );
    } catch (e) { /* 알림 실패는 무시 */ }

    const full = await BloggerRequest.findByPk(request.id, { include: requestInclude });
    res.json({ success: true, data: full });
  } catch (error) {
    console.error('createRequest error:', error);
    res.status(500).json({ success: false, message: '협의 요청 생성에 실패했습니다' });
  }
};

/**
 * 내 협의 요청 목록 (brand 본인 / admin 대리)
 */
exports.getMyRequests = async (req, res) => {
  try {
    const brandId = req.user.role === 'brand'
      ? req.user.id
      : (req.query.viewAsUserId ? parseInt(req.query.viewAsUserId, 10) : null);
    if (!brandId) {
      return res.json({ success: true, data: [] });
    }
    const requests = await BloggerRequest.findAll({
      where: { brand_id: brandId },
      include: requestInclude,
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('getMyRequests error:', error);
    res.status(500).json({ success: false, message: '요청 목록 조회에 실패했습니다' });
  }
};

/**
 * 전체 협의 요청 인박스 (admin)
 * query: status?
 */
exports.getAllRequests = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const requests = await BloggerRequest.findAll({
      where,
      include: [
        ...requestInclude,
        { model: User, as: 'brand', attributes: ['id', 'name', 'username'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('getAllRequests error:', error);
    res.status(500).json({ success: false, message: '요청 인박스 조회에 실패했습니다' });
  }
};

/**
 * 협의 요청 상세 (admin, brand 소유자)
 */
exports.getRequest = async (req, res) => {
  try {
    const request = await BloggerRequest.findByPk(req.params.id, {
      include: [
        ...requestInclude,
        { model: User, as: 'brand', attributes: ['id', 'name', 'username'] }
      ]
    });
    if (!request) return res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다' });
    if (req.user.role === 'brand' && request.brand_id !== req.user.id) {
      return res.status(403).json({ success: false, message: '접근 권한이 없습니다' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('getRequest error:', error);
    res.status(500).json({ success: false, message: '요청 조회에 실패했습니다' });
  }
};

/**
 * 협의 요청 수정 (admin) - 상태/가이드/메모/제품제공방식
 */
exports.updateRequest = async (req, res) => {
  try {
    const request = await BloggerRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다' });

    const prevStatus = request.status;
    const updates = {};
    ['status', 'product_provision', 'guide_text', 'admin_memo'].forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    await request.update(updates);

    // 상태 변경 시 브랜드에 알림
    if (updates.status && updates.status !== prevStatus) {
      try {
        await createNotification(
          request.brand_id,
          'campaign_created',
          '블로거 협의 진행 상황',
          `요청하신 블로거 협의 상태가 '${updates.status}'(으)로 변경되었습니다.`,
          'blogger_request',
          request.id
        );
      } catch (e) { /* 무시 */ }
    }

    const full = await BloggerRequest.findByPk(request.id, { include: requestInclude });
    res.json({ success: true, data: full });
  } catch (error) {
    console.error('updateRequest error:', error);
    res.status(500).json({ success: false, message: '요청 수정에 실패했습니다' });
  }
};

/**
 * 협의 요청 취소 (brand 소유자, admin)
 */
exports.cancelRequest = async (req, res) => {
  try {
    const request = await BloggerRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다' });
    if (req.user.role === 'brand' && request.brand_id !== req.user.id) {
      return res.status(403).json({ success: false, message: '접근 권한이 없습니다' });
    }
    await request.update({ status: 'cancelled' });
    res.json({ success: true });
  } catch (error) {
    console.error('cancelRequest error:', error);
    res.status(500).json({ success: false, message: '요청 취소에 실패했습니다' });
  }
};

/**
 * 요청 항목 수정 (admin) - 참여의사/단가/제품제공방식/배송주소/메모
 */
exports.updateRequestItem = async (req, res) => {
  try {
    const item = await BloggerRequestItem.findByPk(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });

    const updates = {};
    ['participation_status', 'product_provision', 'unit_price', 'shipping_address', 'admin_memo'].forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    await item.update(updates);

    const full = await BloggerRequestItem.findByPk(item.id, {
      include: [{ model: Blogger, as: 'blogger', attributes: ['id', 'activity_name', 'blog_url', 'daily_visitors', 'main_content'] }]
    });
    res.json({ success: true, data: full });
  } catch (error) {
    console.error('updateRequestItem error:', error);
    res.status(500).json({ success: false, message: '항목 수정에 실패했습니다' });
  }
};

/**
 * 항목 제출 토큰 발급 (admin) - 블로거에게 보낼 공개 작성 링크
 */
exports.issueToken = async (req, res) => {
  try {
    const item = await BloggerRequestItem.findByPk(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });
    if (!item.submit_token) {
      await item.update({ submit_token: uuidv4() });
    }
    res.json({ success: true, data: { id: item.id, submit_token: item.submit_token } });
  } catch (error) {
    console.error('issueToken error:', error);
    res.status(500).json({ success: false, message: '제출 토큰 발급에 실패했습니다' });
  }
};
