import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Tabs, Tab, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Avatar, Chip, Alert, CircularProgress, Link, Stack,
  Button, LinearProgress, Tooltip
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { rankingService } from '../../services';

function PriceCell({ row }) {
  const sale = row.sale_price;
  const original = row.original_price;
  const discount = row.discount_rate;

  if (!sale && !original) {
    return <span>{row.price || '-'}</span>;
  }
  if (!sale) {
    return <span style={{ fontWeight: 'bold' }}>{original}</span>;
  }
  if (!original) {
    return <span style={{ fontWeight: 'bold' }}>{sale}</span>;
  }
  return (
    <Stack spacing={0.2}>
      <Box component="span" sx={{ color: 'text.disabled', textDecoration: 'line-through', fontSize: '0.78rem' }}>
        {original}
      </Box>
      <Box component="span">
        {discount ? (
          <Box component="span" sx={{ color: 'error.main', fontWeight: 'bold', mr: 0.6 }}>
            {discount}%
          </Box>
        ) : null}
        <Box component="span" sx={{ fontWeight: 'bold' }}>{sale}</Box>
      </Box>
    </Stack>
  );
}

function AdminRankingDashboard() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [collectedAt, setCollectedAt] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [progress, setProgress] = useState({ job: { running: false }, lastCollectedAt: null, scheduler: null });
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const pollRef = useRef(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await rankingService.getCategories();
      if (res.success) setCategories(res.data || []);
    } catch (err) {
      console.error('카테고리 로드 실패:', err);
    }
  }, []);

  const loadRankings = useCallback(async (categoryId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await rankingService.getLatest(categoryId);
      if (res.success) {
        setCollectedAt(res.data.collected_at);
        setRankings(res.data.rankings || []);
      } else {
        setError(res.message || '데이터를 불러오지 못했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProgress = useCallback(async () => {
    try {
      const res = await rankingService.getProgress();
      if (res.success) setProgress(res.data);
    } catch (_) { /* ignore */ }
  }, []);

  const handleTrigger = useCallback(async (forceFresh = false) => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await rankingService.trigger(forceFresh);
      if (res.status === 'cached') {
        const minutes = Math.round((res.cacheTtlMs || 1800000) / 60000);
        setTriggerMsg({ severity: 'info', text: `최근 ${minutes}분 이내 수집된 데이터를 사용합니다. (강제 새 수집 가능)` });
      } else if (res.status === 'started') {
        setTriggerMsg({ severity: 'success', text: '수집이 시작됐습니다. 진행 상황을 표시합니다.' });
      } else if (res.status === 'busy') {
        setTriggerMsg({ severity: 'warning', text: '이미 수집 중입니다. 진행 상황을 표시합니다.' });
      } else if (res.status === 'cooldown') {
        setTriggerMsg({ severity: 'warning', text: `너무 빠른 연타입니다. ${res.remainSec}초 후 다시 시도해주세요.` });
      } else if (res.status === 'hourly_limit') {
        setTriggerMsg({ severity: 'error', text: `최근 1시간 내 ${res.limit}회 한도를 모두 사용했습니다.` });
      } else if (res.status === 'ip_blocked') {
        setTriggerMsg({ severity: 'error', text: '비정상적 호출이 감지되어 일시 차단되었습니다. 약 1시간 후 다시 시도해주세요.' });
      }
      loadProgress();
    } catch (err) {
      const data = err.response?.data;
      setTriggerMsg({ severity: 'error', text: data?.message || err.message });
    } finally {
      setTriggering(false);
    }
  }, [loadProgress]);

  useEffect(() => {
    loadCategories();
    loadProgress();
  }, [loadCategories, loadProgress]);

  useEffect(() => {
    if (activeCategory) loadRankings(activeCategory);
  }, [activeCategory, loadRankings]);

  // 진행 상황 폴링 (수집 중이면 2초, 아니면 30초)
  useEffect(() => {
    const interval = progress.job?.running ? 2000 : 30000;
    pollRef.current && clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (document.hidden) return;
      loadProgress();
    }, interval);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [progress.job?.running, loadProgress]);

  // 수집 완료 시 자동 새로고침
  const prevRunningRef = useRef(false);
  useEffect(() => {
    if (prevRunningRef.current && !progress.job?.running) {
      // 방금 완료됨 → 현재 카테고리 다시 로드
      if (activeCategory) loadRankings(activeCategory);
    }
    prevRunningRef.current = !!progress.job?.running;
  }, [progress.job?.running, activeCategory, loadRankings]);

  const job = progress.job || { running: false };
  const schedulerNextAt = progress.scheduler?.nextRunAt;
  const proxyEnabled = progress.scheduler?.proxyEnabled;

  return (
    <Container maxWidth="xl" sx={{ pt: 12, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold">올리브영 카테고리 BEST 랭킹</Typography>
        <Box sx={{ flexGrow: 1 }} />
      </Stack>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 2, bgcolor: '#f0f7ff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          {/* 좌측: 최근 수집 시각 크게 */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.3 }}>
              최근 수집 시각
            </Typography>
            <Typography
              variant="h5"
              fontWeight="bold"
              sx={{ color: collectedAt ? 'primary.main' : 'text.disabled', lineHeight: 1.1 }}
            >
              {collectedAt ? new Date(collectedAt).toLocaleString('ko-KR') : '데이터 없음'}
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* 칩들 */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {proxyEnabled !== undefined && (
              <Chip
                label={proxyEnabled ? '프록시 ON' : '프록시 OFF'}
                color={proxyEnabled ? 'success' : 'warning'}
                size="small"
                variant="outlined"
              />
            )}
            {schedulerNextAt && (
              <Chip
                label={`다음 자동: ${new Date(schedulerNextAt).toLocaleString('ko-KR')}`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>

          {/* 우측: 버튼 */}
          <Stack direction="row" spacing={1}>
            <Tooltip title="30분 이내 데이터가 있으면 즉시 표시, 없으면 새로 수집">
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<CloudSyncIcon />}
                  onClick={() => handleTrigger(false)}
                  disabled={triggering || job.running}
                >
                  {job.running ? '수집 중...' : '지금 수집'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="항상 새로 수집">
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleTrigger(true)}
                  disabled={triggering || job.running}
                >
                  강제 새 수집
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
        <strong>자동 수집:</strong> 매 시간 자동으로 최신 데이터를 수집합니다.
        <br />
        <strong>지금 수집:</strong> 최근 30분 이내 수집 데이터가 있으면 즉시 표시, 없으면 새로 수집(약 5분 소요).
        <br />
        <strong>강제 새 수집:</strong> 항상 새로 수집합니다.
      </Alert>

      {triggerMsg && (
        <Alert severity={triggerMsg.severity} sx={{ mb: 2 }} onClose={() => setTriggerMsg(null)}>
          {triggerMsg.text}
        </Alert>
      )}

      {job.running && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#f9f9ff' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            🚀 수집 진행 중 ({job.completed || 0} / {job.total || 21}) — 현재: {job.currentCategory || '시작 중'}
            {job.proxyEnabled ? '' : ' (프록시 OFF)'}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={((job.completed || 0) / (job.total || 21)) * 100}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="caption" color="text.secondary">
            성공 {job.success || 0} · 실패 {job.fail || 0}
          </Typography>
        </Paper>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeCategory}
          onChange={(_, v) => setActiveCategory(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {categories.map((c) => (
            <Tab key={c.id} value={c.id} label={c.name} />
          ))}
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : rankings.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>이 카테고리에 수집된 데이터가 없습니다.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ width: 60, fontWeight: 'bold' }}>순위</TableCell>
                <TableCell sx={{ width: 80, fontWeight: 'bold' }}>이미지</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                <TableCell sx={{ width: 160, fontWeight: 'bold' }}>브랜드</TableCell>
                <TableCell sx={{ width: 160, fontWeight: 'bold' }}>가격</TableCell>
                <TableCell sx={{ width: 140, fontWeight: 'bold' }}>상품 코드</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankings.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography variant="h6" color={r.rank <= 3 ? 'error.main' : 'text.primary'}>
                      {r.rank}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.image_url ? (
                      <Avatar variant="rounded" src={r.image_url} sx={{ width: 56, height: 56 }} />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {r.product_url ? (
                      <Link href={r.product_url} target="_blank" rel="noopener" underline="hover">
                        {r.product_name || '(이름 없음)'}
                      </Link>
                    ) : (
                      r.product_name || '(이름 없음)'
                    )}
                  </TableCell>
                  <TableCell>{r.brand_name || '-'}</TableCell>
                  <TableCell><PriceCell row={r} /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.goods_no || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Container>
  );
}

export default AdminRankingDashboard;
