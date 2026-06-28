import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, CircularProgress, Alert,
  Avatar, Chip, Stack, IconButton, Tooltip
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
      const res = await aiChatService.sendMessage(apiMessages, sentAttachment);
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
  }, [input, loading, messages, attachment]);

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
                    이 답변 비용: 약 ${m.usage.cost_usd.toFixed(3)} (약 {Math.round(m.usage.cost_usd * 1380).toLocaleString()}원)
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
