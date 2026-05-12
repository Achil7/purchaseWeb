import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Avatar, Chip, Alert, CircularProgress, Stack, Link,
  Button, LinearProgress
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { rankingService } from '../../services';

function BrandRankingView() {
  const [collectedAt, setCollectedAt] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [progress, setProgress] = useState({ job: { running: false }, lastCollectedAt: null });
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const pollRef = useRef(null);
  const prevRunningRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const viewAsUserId = params.get('viewAsUserId');
      const res = await rankingService.getMyProducts(viewAsUserId);
      if (res.success) {
        setCollectedAt(res.data.collected_at);
        setProducts(res.data.products || []);
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

  const handleTrigger = useCallback(async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await rankingService.trigger(false);
      if (res.status === 'cached') {
        const minutes = Math.round((res.cacheTtlMs || 1800000) / 60000);
        setTriggerMsg({ severity: 'info', text: `최근 ${minutes}분 이내 수집된 데이터를 보여드립니다.` });
      } else if (res.status === 'started') {
        setTriggerMsg({ severity: 'success', text: '수집이 시작되었습니다. 약 5분 후 결과가 갱신됩니다.' });
      } else if (res.status === 'busy') {
        setTriggerMsg({ severity: 'warning', text: '다른 사용자의 수집이 진행 중입니다. 완료되면 함께 갱신됩니다.' });
      } else if (res.status === 'cooldown') {
        setTriggerMsg({ severity: 'warning', text: `너무 빠른 연타입니다. ${res.remainSec}초 후 다시 시도해주세요.` });
      } else if (res.status === 'hourly_limit') {
        setTriggerMsg({ severity: 'error', text: `최근 1시간 내 ${res.limit}회 한도를 모두 사용했습니다. 자동 수집은 계속 진행됩니다.` });
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
    load();
    loadProgress();
  }, [load, loadProgress]);

  useEffect(() => {
    const interval = progress.job?.running ? 2000 : 30000;
    pollRef.current && clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (document.hidden) return;
      loadProgress();
    }, interval);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [progress.job?.running, loadProgress]);

  useEffect(() => {
    if (prevRunningRef.current && !progress.job?.running) {
      load();
    }
    prevRunningRef.current = !!progress.job?.running;
  }, [progress.job?.running, load]);

  const exposed = products.filter((p) => p.rankings.length > 0);
  const notExposed = products.filter((p) => p.rankings.length === 0);
  const job = progress.job || { running: false };

  return (
    <Container maxWidth="xl" sx={{ pt: 12, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold">올리브영 BEST 노출 현황</Typography>
        <Chip
          icon={<RefreshIcon />}
          label={collectedAt ? `최근 수집: ${new Date(collectedAt).toLocaleString('ko-KR')}` : '수집 데이터 없음'}
          color={collectedAt ? 'success' : 'default'}
          variant="outlined"
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudSyncIcon />}
          onClick={handleTrigger}
          disabled={triggering || job.running}
        >
          {job.running ? '수집 중...' : '🔄 지금 확인'}
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        등록하신 제품 URL의 올리브영 상품코드를 카테고리 BEST 100과 매칭한 결과입니다.
        30분 이내 수집 데이터가 있으면 즉시 표시되고, 그렇지 않으면 새로 수집합니다 (약 5분 소요).
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
          </Typography>
          <LinearProgress
            variant="determinate"
            value={((job.completed || 0) / (job.total || 21)) * 100}
            sx={{ height: 10, borderRadius: 5 }}
          />
        </Paper>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'success.main' }}>
            BEST 노출 제품 ({exposed.length}개)
          </Typography>
          <Paper sx={{ mb: 4 }}>
            {exposed.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>현재 BEST 100에 노출된 제품이 없습니다.</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ width: 80, fontWeight: 'bold' }}>이미지</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                    <TableCell sx={{ width: 140, fontWeight: 'bold' }}>상품 코드</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>노출 카테고리 / 순위</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exposed.map((p) => (
                    <TableRow key={p.goods_no} hover>
                      <TableCell>
                        {p.image_url ? (
                          <Avatar variant="rounded" src={p.image_url} sx={{ width: 56, height: 56 }} />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {p.product_url ? (
                          <Link href={p.product_url} target="_blank" rel="noopener" underline="hover">
                            {p.product_name || '(이름 없음)'}
                          </Link>
                        ) : (
                          p.product_name || '(이름 없음)'
                        )}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{p.goods_no}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {p.rankings.map((r) => (
                            <Chip
                              key={`${r.category_id}_${r.rank}`}
                              label={`${r.category_name} ${r.rank}위`}
                              color={r.rank <= 10 ? 'error' : r.rank <= 30 ? 'warning' : 'default'}
                              size="small"
                            />
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>

          <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
            미노출 제품 ({notExposed.length}개)
          </Typography>
          <Paper>
            {notExposed.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>모든 제품이 BEST 100에 노출 중입니다.</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                    <TableCell sx={{ width: 140, fontWeight: 'bold' }}>상품 코드</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notExposed.map((p) => (
                    <TableRow key={p.goods_no}>
                      <TableCell>{p.product_name || '(이름 없음)'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{p.goods_no}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      )}
    </Container>
  );
}

export default BrandRankingView;
