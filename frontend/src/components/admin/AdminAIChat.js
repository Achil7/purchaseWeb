import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, CircularProgress, Alert,
  Avatar, Chip, Stack, IconButton, Tooltip, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../context/AuthContext';
import { aiChatService } from '../../services';
import { parseUploadFile } from '../../utils/parseUploadFile';

// 마크다운(표/굵게 등) 렌더 스타일
const mdSx = {
  fontSize: 14,
  wordBreak: 'break-word',
  '& p': { m: 0, mb: 1 },
  '& p:last-child': { mb: 0 },
  '& table': { borderCollapse: 'collapse', width: '100%', my: 1, fontSize: 13 },
  '& th, & td': { border: '1px solid #d0d0d0', px: 1, py: 0.5, textAlign: 'left', verticalAlign: 'top' },
  '& th': { bgcolor: '#f0f3f7', fontWeight: 'bold', whiteSpace: 'nowrap' },
  '& tr:nth-of-type(even) td': { bgcolor: '#fafafa' },
  '& ul, & ol': { m: 0, mb: 1, pl: 2.5 },
  '& code': { bgcolor: '#f0f0f0', px: 0.5, borderRadius: '3px', fontSize: 12 },
  '& h1, & h2, & h3, & h4': { m: 0, mt: 1, mb: 0.5, fontSize: 15 },
  '& blockquote': { m: 0, my: 1, pl: 1.5, borderLeft: '3px solid #ccc', color: 'text.secondary' },
};

// 운영(prod)은 masterkangwoo 전용, test 도메인은 모든 admin 허용
const ALLOWED_AI_CHAT_USERS = ['masterkangwoo'];
const IS_TEST_ENV = typeof window !== 'undefined' && window.location.hostname.includes('test');

// 모델 선택 (비개발자 안내용). 질문 난이도에 비용을 맞추기 위한 것.
// title=한글 용도, subtitle=짧은 특징, help=어떤 질문에 쓰는지 예시 포함 자세한 설명
const DEFAULT_AI_MODEL = 'claude-sonnet-4-6';
const MODEL_OPTIONS = [
  {
    value: 'claude-haiku-4-5',
    title: '간단 조회',
    subtitle: '빠르고 저렴',
    help:
      '숫자를 세거나 목록을 보는 간단한 질문에 쓰세요. ' +
      '예) "브랜드 계정 몇 개야?", "이번 캠페인 구매자 몇 명이야?", "이 제품 등록된 거 있어?". ' +
      '비용이 가장 쌉니다(보통 일반 분석의 1/3 정도). ' +
      '단, 여러 단계로 계산하거나 대조하는 질문에는 틀릴 수 있으니 쓰지 마세요.',
  },
  {
    value: 'claude-sonnet-4-6',
    title: '일반 분석 (추천)',
    subtitle: '정확하고 균형',
    help:
      '평소 대부분의 질문은 이걸 쓰세요. ' +
      '예) "이번 달 브랜드별 매출 정리해줘", "입금 안 된 건 찾아줘", "이상한 금액 있는지 봐줘", "마진 계산해줘". ' +
      '정확해야 하는 일반 업무에 적합하고 비용은 중간입니다. 무엇을 고를지 모르겠으면 이걸 쓰세요.',
  },
  {
    value: 'claude-opus-4-8',
    title: '정밀 대조',
    subtitle: '가장 똑똑·가장 비쌈',
    help:
      '가장 어렵고 틀리면 안 되는 작업에만 쓰세요. ' +
      '예) "내가 올린 견적서를 이번 달 DB와 한 건씩 대조해서 다른 곳 찾아줘", ' +
      '여러 조건이 얽힌 복잡한 검증, 긴 PDF 리포트 만들기. ' +
      '비용이 가장 비쌉니다(일반 분석의 약 1.7배). 간단한 질문에 쓰면 돈만 더 나가니 주의하세요.',
  },
];
const MODEL_SHORT = {
  'claude-haiku-4-5': '간단 조회',
  'claude-sonnet-4-6': '일반 분석',
  'claude-opus-4-8': '정밀 대조',
};

// 빈 화면 예시 질문
const EXAMPLE_QUESTIONS = [
  '이번 달 등록된 캠페인은 몇 개야?',
  '오늘 날짜 작업 데이터 검증해줘 (중복·빈값·이상치·날짜)',
  '이번 달 중복 주문번호랑 금액 이상치 찾아줘',
  '진행률은 어떻게 계산돼?',
  '임시구매자(선 업로드)가 뭐야?',
];

function AdminAIChat() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]); // { role, content, error?, pdfArtifacts?, attachmentName? }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null); // 파싱된 첨부(단발)
  const [attachError, setAttachError] = useState('');
  // 선택 모델(질문 난이도에 비용 맞추기). localStorage로 계정 무관 전역 유지
  const [model, setModel] = useState(() => {
    try {
      const saved = localStorage.getItem('aichat_model');
      return MODEL_OPTIONS.some((o) => o.value === saved) ? saved : DEFAULT_AI_MODEL;
    } catch (e) { return DEFAULT_AI_MODEL; }
  });
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadedRef = useRef(false);

  const storageKey = user?.username ? `aichat_history_${user.username}` : null;

  // 접근 허용: test 도메인=모든 admin, 운영=masterkangwoo만
  const authorized = IS_TEST_ENV || (!!user?.username && ALLOWED_AI_CHAT_USERS.includes(user.username));

  // 비허용 계정은 기능 존재 자체를 노출하지 않도록 조용히 리다이렉트 (alert 없음)
  useEffect(() => {
    if (user && !authorized) {
      navigate('/admin', { replace: true });
    }
  }, [user, authorized, navigate]);

  // 대화 복원 (localStorage, 계정별) — mount/계정확정 시 1회
  useEffect(() => {
    if (!storageKey || loadedRef.current) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch (e) { /* ignore */ }
    loadedRef.current = true;
  }, [storageKey]);

  // 대화 저장 — 최근 100개, pdfArtifacts(base64) 제외(용량 보호)
  useEffect(() => {
    if (!storageKey || !loadedRef.current) return;
    try {
      const slim = messages.slice(-100).map((m) => ({
        role: m.role,
        content: m.content,
        error: m.error,
        attachmentName: m.attachmentName,
      }));
      localStorage.setItem(storageKey, JSON.stringify(slim));
    } catch (e) { /* quota 등 무시 */ }
  }, [messages, storageKey]);

  // 선택 모델 저장
  useEffect(() => {
    try { localStorage.setItem('aichat_model', model); } catch (e) { /* ignore */ }
  }, [model]);

  const clearChat = () => {
    setMessages([]);
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch (e) { /* ignore */ }
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능하게 초기화
    if (!file) return;
    setAttachError('');
    try {
      const parsed = await parseUploadFile(file);
      setAttachment(parsed);
    } catch (err) {
      setAttachment(null);
      setAttachError(err.message || '파일을 읽을 수 없습니다.');
    }
  };

  const handleSend = useCallback(async (text) => {
    const typed = (text ?? input).trim();
    if (loading) return;
    if (!typed && !attachment) return;

    const content = typed || `${attachment.fileName} 파일을 DB 데이터와 대조 검증해줘`;
    const userMsg = { role: 'user', content, attachmentName: attachment?.fileName };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    const sentAttachment = attachment;
    setAttachment(null);
    setAttachError('');
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await aiChatService.sendMessage(apiMessages, sentAttachment, model);
      if (res.success) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: res.answer, pdfArtifacts: res.pdfArtifacts || [], usage: res.usage },
        ]);
      } else {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: res.message || '오류가 발생했습니다.', error: true },
        ]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '요청 처리 중 오류가 발생했습니다.';
      setMessages([...newMessages, { role: 'assistant', content: msg, error: true }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, attachment, model]);

  const selectedModelInfo = MODEL_OPTIONS.find((o) => o.value === model) || MODEL_OPTIONS[1];

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const downloadPdf = (a) => {
    const bytes = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
    saveAs(new Blob([bytes], { type: 'application/pdf' }), `${a.title || 'report'}.pdf`);
  };

  // 비허용 계정은 UI를 아예 렌더하지 않음 (기능 미노출 + 화면 깜빡임 방지)
  if (!authorized) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <SmartToyIcon color="primary" />
        <Typography variant="h5" fontWeight="bold">AI 챗</Typography>
        {!IS_TEST_ENV && <Chip label="masterkangwoo 전용" size="small" color="warning" sx={{ ml: 1 }} />}
        <Box sx={{ flexGrow: 1 }} />
        {messages.length > 0 && (
          <Button size="small" color="inherit" startIcon={<DeleteOutlineIcon />} onClick={clearChat}>
            대화 지우기
          </Button>
        )}
      </Box>

      {/* 모델 선택 (비개발자 안내) — 질문 난이도에 비용을 맞추기 위한 것 */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          모델 선택 — 질문이 어려울수록 오른쪽(정밀·비쌈), 단순할수록 왼쪽(간단·저렴)
        </Typography>
        <ToggleButtonGroup
          value={model}
          exclusive
          size="small"
          fullWidth
          disabled={loading}
          onChange={(e, v) => { if (v) setModel(v); }}
        >
          {MODEL_OPTIONS.map((o) => (
            <ToggleButton
              key={o.value}
              value={o.value}
              sx={{ textTransform: 'none', flexDirection: 'column', alignItems: 'center', py: 0.5, px: 1 }}
            >
              <Typography variant="body2" fontWeight="bold" component="span">{o.title}</Typography>
              <Typography variant="caption" color="text.secondary" component="span">{o.subtitle}</Typography>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Alert severity="info" icon={false} sx={{ mt: 0.5, py: 0, '& .MuiAlert-message': { py: 0.75 } }}>
          <Typography variant="caption">
            <strong>{selectedModelInfo.title}</strong> · {selectedModelInfo.help}
          </Typography>
        </Alert>
      </Box>

      {/* 대화 영역 */}
      <Paper
        variant="outlined"
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, bgcolor: '#fafafa' }}
      >
        {messages.length === 0 ? (
          <Box sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}>
            <SmartToyIcon sx={{ fontSize: 48, opacity: 0.3 }} />
            <Typography sx={{ mt: 1, mb: 2 }}>무엇이든 물어보세요. 예시:</Typography>
            <Stack spacing={1} alignItems="center">
              {EXAMPLE_QUESTIONS.map((q) => (
                <Chip
                  key={q}
                  label={q}
                  variant="outlined"
                  onClick={() => handleSend(q)}
                  sx={{ cursor: 'pointer', maxWidth: '100%', height: 'auto', py: 0.5 }}
                />
              ))}
            </Stack>
          </Box>
        ) : (
          messages.map((m, idx) => (
            <Box
              key={idx}
              sx={{ display: 'flex', gap: 1, mb: 2, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}
            >
              <Avatar sx={{ bgcolor: m.role === 'user' ? '#2c387e' : '#00897b', width: 32, height: 32 }}>
                {m.role === 'user' ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
              </Avatar>
              <Box sx={{ maxWidth: '78%' }}>
                <Paper
                  sx={{
                    px: 2, py: 1,
                    bgcolor: m.role === 'user' ? '#e8eaf6' : m.error ? '#ffebee' : '#ffffff',
                    border: m.error ? '1px solid #ef9a9a' : 'none',
                  }}
                >
                  {m.attachmentName && (
                    <Chip
                      icon={<AttachFileIcon />}
                      label={m.attachmentName}
                      size="small"
                      sx={{ mb: 0.5 }}
                    />
                  )}
                  {m.role === 'assistant' && !m.error ? (
                    <Box sx={mdSx}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </Box>
                  ) : (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {m.content}
                    </Typography>
                  )}
                </Paper>

                {/* PDF 다운로드 버튼 */}
                {m.pdfArtifacts && m.pdfArtifacts.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                    {m.pdfArtifacts.map((a, i) => (
                      <Button
                        key={i}
                        size="small"
                        variant="outlined"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={() => downloadPdf(a)}
                      >
                        {(a.title || 'report')}.pdf 다운로드
                      </Button>
                    ))}
                  </Stack>
                )}

                {m.role === 'assistant' && m.usage?.cost_usd != null && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.disabled' }}>
                    {m.usage.model ? `${MODEL_SHORT[m.usage.model] || m.usage.model} · ` : ''}이 답변 비용: 약 ${m.usage.cost_usd.toFixed(3)} (약 {Math.round(m.usage.cost_usd * 1380).toLocaleString()}원)
                  </Typography>
                )}
              </Box>
            </Box>
          ))
        )}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 2 }}>
            <Avatar sx={{ bgcolor: '#00897b', width: 32, height: 32 }}>
              <SmartToyIcon fontSize="small" />
            </Avatar>
            <CircularProgress size={18} />
            <Typography variant="body2">처리 중...</Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </Paper>

      {/* 첨부 상태 / 에러 */}
      {attachError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setAttachError('')}>{attachError}</Alert>}
      {attachment && (
        <Box sx={{ mt: 1 }}>
          <Chip
            icon={<AttachFileIcon />}
            label={`${attachment.fileName} (${attachment.rowCount}행${attachment.truncated ? ', 상위 200행만 사용' : ''})`}
            onDelete={() => setAttachment(null)}
            color="primary"
            variant="outlined"
          />
        </Box>
      )}

      {/* 입력 영역 */}
      <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-end' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFilePick}
        />
        <Tooltip title="파일 첨부">
          <span>
            <IconButton onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <AttachFileIcon />
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <Button
          variant="contained"
          endIcon={<SendIcon />}
          onClick={() => handleSend()}
          disabled={loading || (!input.trim() && !attachment)}
          sx={{ minWidth: 100 }}
        >
          전송
        </Button>
      </Box>
    </Box>
  );
}

export default AdminAIChat;
