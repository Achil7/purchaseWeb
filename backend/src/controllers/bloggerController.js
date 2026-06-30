const { Blogger } = require('../models');

// 브랜드에 노출하지 않는 내부 필드를 제외한 컬럼
const BRAND_ATTRIBUTES = [
  'id', 'activity_name', 'blog_url', 'daily_visitors', 'main_content', 'is_active'
];

/**
 * 블로거 목록 조회
 * - admin: 전체(비활성 포함) + memo 등 내부 필드 포함
 * - brand: is_active=true 만, 내부 필드(memo/created_by) 제외
 * (전역 공통 목록 - brand_id 필터 없음)
 */
exports.getBloggers = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const where = {};
    if (!isAdmin) {
      where.is_active = true;
    }

    const bloggers = await Blogger.findAll({
      where,
      attributes: isAdmin ? undefined : BRAND_ATTRIBUTES,
      order: [['id', 'ASC']]
    });

    res.json({ success: true, data: bloggers });
  } catch (error) {
    console.error('getBloggers error:', error);
    res.status(500).json({ success: false, message: '블로거 목록 조회에 실패했습니다' });
  }
};

/**
 * 블로거 등록 (admin 전용)
 */
exports.createBlogger = async (req, res) => {
  try {
    const { activity_name, blog_url, daily_visitors, main_content, memo, is_active } = req.body;

    if (!activity_name || !activity_name.trim()) {
      return res.status(400).json({ success: false, message: '활동명은 필수입니다' });
    }

    const blogger = await Blogger.create({
      activity_name: activity_name.trim(),
      blog_url: blog_url || null,
      daily_visitors: daily_visitors || null,
      main_content: main_content || null,
      memo: memo || null,
      is_active: is_active !== undefined ? !!is_active : true,
      created_by: req.user.id
    });

    res.json({ success: true, data: blogger });
  } catch (error) {
    console.error('createBlogger error:', error);
    res.status(500).json({ success: false, message: '블로거 등록에 실패했습니다' });
  }
};

/**
 * 블로거 수정 (admin 전용)
 */
exports.updateBlogger = async (req, res) => {
  try {
    const { id } = req.params;
    const blogger = await Blogger.findByPk(id);
    if (!blogger) {
      return res.status(404).json({ success: false, message: '블로거를 찾을 수 없습니다' });
    }

    const updates = {};
    ['activity_name', 'blog_url', 'daily_visitors', 'main_content', 'memo', 'is_active'].forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    await blogger.update(updates);
    res.json({ success: true, data: blogger });
  } catch (error) {
    console.error('updateBlogger error:', error);
    res.status(500).json({ success: false, message: '블로거 수정에 실패했습니다' });
  }
};

/**
 * 블로거 삭제 (admin 전용, soft delete)
 */
exports.deleteBlogger = async (req, res) => {
  try {
    const { id } = req.params;
    const blogger = await Blogger.findByPk(id);
    if (!blogger) {
      return res.status(404).json({ success: false, message: '블로거를 찾을 수 없습니다' });
    }
    await blogger.destroy(); // paranoid → soft delete
    res.json({ success: true });
  } catch (error) {
    console.error('deleteBlogger error:', error);
    res.status(500).json({ success: false, message: '블로거 삭제에 실패했습니다' });
  }
};

/**
 * 노출 토글 (admin 전용)
 */
exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const blogger = await Blogger.findByPk(id);
    if (!blogger) {
      return res.status(404).json({ success: false, message: '블로거를 찾을 수 없습니다' });
    }
    await blogger.update({ is_active: !blogger.is_active });
    res.json({ success: true, data: blogger });
  } catch (error) {
    console.error('toggleActive error:', error);
    res.status(500).json({ success: false, message: '노출 상태 변경에 실패했습니다' });
  }
};
