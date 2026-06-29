import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Container, Paper, Typography, TextField, Button, Alert, CircularProgress, Stack, Chip, Link
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import { bloggerService } from '../../services';
import { provisionLabel } from '../../utils/bloggerLabels';

function BloggerSubmitPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bloggerService.getSubmitByToken(token);
      if (res.success) {
        setInfo(res.data);
        if (res.data.submission_url) setUrl(res.data.submission_url);
      } else {
        setError(res.message || '유효하지 않은 제출 링크입니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || '유효하지 않은 제출 링크입니다');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  const handleSubmit = async () => {
    if (!url.trim()) { setError('작성한 블로그 글 링크를 입력해주세요'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await bloggerService.submitUrl(token, url.trim());
      if (res.success) setDone(true);
      else setError(res.message || '제출에 실패했습니다');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !info) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>블로그 작성 링크 제출</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          작성하신 블로그 글의 링크를 아래에 입력해 제출해 주세요.
        </Typography>

        {/* 컨텍스트 */}
        <Stack spacing={1} sx={{ mb: 3 }}>
          {info?.activity_name && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>활동명</Typography>
              <Typography variant="body2" fontWeight={500}>{info.activity_name}</Typography>
            </Stack>
          )}
          {info?.campaign_name && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>캠페인</Typography>
              <Typography variant="body2">{info.campaign_name}</Typography>
            </Stack>
          )}
          {info?.product_provision && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>제품 제공</Typography>
              <Chip size="small" label={provisionLabel(info.product_provision)} />
            </Stack>
          )}
        </Stack>

        {info?.guide_text && (
          <Alert severity="info" variant="outlined" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>
            <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>작성 가이드</Typography>
            {info.guide_text}
          </Alert>
        )}

        {done ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
            <Typography variant="h6" fontWeight="bold">제출이 완료되었습니다</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              담당자가 확인 후 진행합니다. 감사합니다.
            </Typography>
            {url && (
              <Link href={url} target="_blank" rel="noopener" sx={{ display: 'block', mt: 2 }}>
                제출한 링크 확인
              </Link>
            )}
          </Box>
        ) : (
          <>
            {info?.submitted_at && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                이미 제출된 링크가 있습니다 ({new Date(info.submitted_at).toLocaleString('ko-KR')}). 다시 제출하면 덮어쓰여집니다.
              </Alert>
            )}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              label="블로그 글 링크"
              placeholder="https://blog.naver.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<SendIcon />}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '제출 중...' : '제출하기'}
            </Button>
          </>
        )}
      </Paper>
    </Container>
  );
}

export default BloggerSubmitPage;
