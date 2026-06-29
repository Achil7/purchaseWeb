const aiChatService = require('../services/aiChatService');
const { AI_CHAT_ENABLED } = require('../config/anthropic');

/**
 * AI 챗 접근 허용 정책 (환경변수 AI_CHAT_ALLOWED_USERS)
 * - 미설정/빈값 → 모든 admin 허용 (test 환경 기본)
 * - 'masterkangwoo' 등 콤마 구분 username 목록 → 해당 계정만 허용 (운영 환경)
 * @returns {string[]|null} null이면 모든 admin 허용
 */
const getAllowedUsers = () => {
  const raw = (process.env.AI_CHAT_ALLOWED_USERS || '').trim();
  if (!raw) return null;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};

// 첨부 파일(클라 SheetJS 파싱 결과) 서버 2차 검증/캡
const MAX_ATTACH_ROWS = 200;
const MAX_ATTACH_BYTES = 256 * 1024; // 256KB

const validateAttachment = (attachment) => {
  if (attachment == null) return null;
  if (typeof attachment !== 'object' || !Array.isArray(attachment.rows)) {
    throw new Error('첨부 형식이 올바르지 않습니다.');
  }
  if (attachment.rows.length > MAX_ATTACH_ROWS) {
    throw new Error(`첨부 행이 너무 많습니다(최대 ${MAX_ATTACH_ROWS}행).`);
  }
  const safe = {
    fileName: String(attachment.fileName || 'uploaded').slice(0, 200),
    columns: Array.isArray(attachment.columns) ? attachment.columns.map((c) => String(c)) : [],
    rows: attachment.rows,
    rowCount: Number(attachment.rowCount) || attachment.rows.length,
    truncated: !!attachment.truncated,
  };
  if (JSON.stringify(safe).length > MAX_ATTACH_BYTES) {
    throw new Error('첨부 데이터가 너무 큽니다(최대 256KB).');
  }
  return safe;
};

/**
 * POST /api/ai-chat
 * body: { messages: [{ role: 'user'|'assistant', content: string }, ...] }
 */
exports.chat = async (req, res) => {
  try {
    if (!AI_CHAT_ENABLED) {
      return res.status(503).json({
        success: false,
        message: 'AI 챗 기능이 비활성화되어 있습니다. (AI_CHAT_ENABLED)',
      });
    }

    // 백엔드 게이트 (프론트 체크 우회 방지). 환경변수로 운영=masterkangwoo, test=모든 admin 제어
    const allowedUsers = getAllowedUsers();
    if (allowedUsers && !allowedUsers.includes(req.user.username)) {
      return res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다.',
      });
    }

    const { messages, attachment, model } = req.body;

    let safeAttachment = null;
    try {
      safeAttachment = validateAttachment(attachment);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'messages 배열이 필요합니다.',
      });
    }

    if (messages[0].role !== 'user') {
      return res.status(400).json({
        success: false,
        message: '첫 메시지는 user 여야 합니다.',
      });
    }

    // 형식 검증 (role/content 문자열)
    const valid = messages.every(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    );
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: '각 메시지는 { role: "user"|"assistant", content: string } 형식이어야 합니다.',
      });
    }

    const result = await aiChatService.runChat(messages, { attachment: safeAttachment, model });

    return res.json({
      success: true,
      answer: result.answer,
      executedQueries: result.executedQueries,
      pdfArtifacts: result.pdfArtifacts || [],
      usage: result.usage,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'AI 챗 처리 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
};
