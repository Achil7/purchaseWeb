import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Chip, Alert, CircularProgress, Stack, Link,
  Button, LinearProgress, ToggleButtonGroup, ToggleButton, Tooltip,
  Grid, IconButton, Collapse
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { rankingService } from '../../services';
import RankingHistoryDialog from '../admin/RankingHistoryDialog';
import {
  formatElapsed,
  RankChangeBadge,
  MiniSparkline
} from '../admin/AdminRankingDashboard';

function BrandRankingView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [windowParam, setWindowParam] = useState('24h');

  // 진행 상태 / 트리거
  const [progress, setProgress] = useState({ job: { running: false }, lastCollectedAt: null, scheduler: null, cacheActive: false });
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const pollRef = useRef(null);
  const prevRunningRef = useRef(false);
  const [, setTick] = useState(0);

  // 이탈/미노출 접기
  const [dropoutsExpanded, setDropoutsExpanded] = useState(false);
  const [notExposedExpanded, setNotExposedExpanded] = useState(false);

  // 추이 모달
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyCategoryId, setHistoryCategoryId] = useState(null);

  // viewAsUserId (admin이 브랜드사 대신 볼 때) — BrandLayout이 ?userId=N 으로 전달
  const viewAsUserId = new URLSearchParams(window.location.search).get('userId');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rankingService.getMyChanges(windowParam, viewAsUserId);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.message || '데이터를 불러오지 못했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [windowParam, viewAsUserId]);

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
        setTriggerMsg({ severity: 'info', text: `최근 ${minutes}분 이내 수집된 데이터를 사용합니다.` });
      } else if (res.status === 'started') {
        setTriggerMsg({ severity: 'success', text: '수집이 시작되었습니다. 약 5분 후 결과가 갱신됩니다.' });
      } else if (res.status === 'busy') {
        const meta = res.jobMeta || {};
        const completed = meta.completed || 0;
        const total = meta.total || 21;
        const elapsedText = meta.elapsedMs ? formatElapsed(meta.elapsedMs) : null;
        const parts = [`이미 수집 중인 작업이 있습니다 (${completed}/${total} 완료`];
        if (elapsedText) parts.push(`, ${elapsedText} 경과`);
        parts.push('). 완료 후 자동 갱신됩니다.');
        setTriggerMsg({ severity: 'warning', text: parts.join('') });
      } else if (res.status === 'cooldown') {
        setTriggerMsg({ severity: 'warning', text: `너무 빠른 연타입니다. ${res.remainSec}초 후 다시 시도해주세요.` });
      } else if (res.status === 'hourly_limit') {
        setTriggerMsg({ severity: 'error', text: `최근 1시간 내 ${res.limit}회 한도를 모두 사용했습니다. 자동 수집은 계속 진행됩니다.` });
      } else if (res.status === 'ip_blocked') {
        setTriggerMsg({ severity: 'error', text: '비정상적 호출이 감지되어 일시 차단되었습니다. 약 1시간 후 다시 시도해주세요.' });
      } else if (res.status === 'proxy_disabled') {
        setTriggerMsg({ severity: 'warning', text: '현재 수집이 비활성화 상태입니다. 잠시 후 다시 시도해주세요.' });
      }
      loadProgress();
    } catch (err) {
      const d = err.response?.data;
      setTriggerMsg({ severity: 'error', text: d?.message || err.message });
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

  // 진행 중 → 완료 시 데이터 다시 로드
  useEffect(() => {
    if (prevRunningRef.current && !progress.job?.running) {
      load();
    }
    prevRunningRef.current = !!progress.job?.running;
  }, [progress.job?.running, load]);

  // 경과시간 1초 갱신
  useEffect(() => {
    if (!progress.job?.running) return;
    const id = setInterval(() => setTick(t => (t + 1) % 100000), 1000);
    return () => clearInterval(id);
  }, [progress.job?.running]);

  const job = progress.job || { running: false };
  const collectedAt = data?.currentCollectedAt;
  const previousCollectedAt = data?.previousCollectedAt;
  const products = data?.products || [];
  const dropouts = data?.dropouts || [];
  const insights = data?.insights || { biggestGainers: [], biggestLosers: [], newEntries: [], consistent: [] };
  const summary = data?.summary || { totalRegistered: 0, exposedNow: 0, exposedRankings: 0, top10Count: 0, currentlyExposedNow: 0 };
  const windowHoursLabel = data?.windowHours ? `${data.windowHours}h` : '24h';

  const prevTimeLabel = previousCollectedAt
    ? new Date(previousCollectedAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const exposed = products.filter(p => p.rankings.length > 0);
  const notExposed = products.filter(p => p.rankings.length === 0);

  const openHistory = (product, categoryId) => {
    setHistoryProduct(product);
    setHistoryCategoryId(categoryId);
    setHistoryOpen(true);
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <Container maxWidth="xl" sx={{ pt: 2, pb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight="bold">올리브영 BEST 노출 현황</Typography>
          <Box sx={{ flexGrow: 1 }} />
        </Stack>

      {/* 상단 정보 패널 */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2, bgcolor: '#f0f7ff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
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
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {progress.cacheActive && !job.running && (
              <Tooltip title="최근 30분 이내 수집된 데이터를 사용 중입니다. 자동 수집은 매시간 진행됩니다.">
                <Chip label="캐시 활용 중" color="info" size="small" variant="outlined" />
              </Tooltip>
            )}
            {progress.scheduler?.nextRunAt && (
              <Chip
                label={`다음 자동: ${new Date(progress.scheduler.nextRunAt).toLocaleString('ko-KR')}`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title={!progress.scheduler?.proxyEnabled ? '현재 수집을 사용할 수 없습니다' : '30분 이내 데이터가 있으면 즉시 표시, 없으면 새로 수집'}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<CloudSyncIcon />}
                  onClick={handleTrigger}
                  disabled={triggering || job.running || progress.scheduler?.proxyEnabled === false}
                >
                  {job.running ? '수집 중...' : '지금 확인'}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
        등록하신 제품 URL의 올리브영 상품코드를 카테고리 BEST 100과 매칭한 결과입니다.
        매시간 자동으로 수집됩니다.
      </Alert>

      {triggerMsg && (
        <Alert severity={triggerMsg.severity} sx={{ mb: 2 }} onClose={() => setTriggerMsg(null)}>
          {triggerMsg.text}
        </Alert>
      )}

      {/* 진행 중 패널 (익명) */}
      {job.running && (() => {
        const elapsedMs = job.startedAt
          ? Date.now() - new Date(job.startedAt).getTime()
          : (job.elapsedMs || 0);
        return (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#f9f9ff' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="subtitle2">
                🚀 수집 진행 중 ({job.completed || 0} / {job.total || 21})
              </Typography>
              <Chip
                size="small"
                label={`진행 시간: ${formatElapsed(elapsedMs)}`}
                variant="outlined"
                sx={{ height: 22 }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              현재: {job.currentCategory || '시작 중'}
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
        );
      })()}

      {/* 요약 KPI 카드 4개 */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label="등록 제품"
            value={summary.totalRegistered}
            unit="개"
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label={`BEST 노출 (${windowHoursLabel})`}
            value={summary.exposedNow}
            unit="개"
            color="#2e7d32"
            hint={
              summary.totalRegistered > 0
                ? `${Math.round(summary.exposedNow / summary.totalRegistered * 100)}% · 현재 ${summary.currentlyExposedNow || 0}개`
                : null
            }
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label={`노출 인스턴스 (${windowHoursLabel})`}
            value={summary.exposedRankings}
            unit="회"
            color="#0288d1"
            hint="(제품 × 카테고리, 누적)"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label={`TOP 10 노출 (${windowHoursLabel})`}
            value={summary.top10Count}
            unit="건"
            color="#c62828"
            hint="기간 내 한 번이라도 TOP10"
          />
        </Grid>
      </Grid>

      {/* 시간 창 + 변동 기준 안내 */}
      <Paper variant="outlined" sx={{ mb: 1.5, px: 2, py: 0.8 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Tooltip
            arrow
            placement="bottom-start"
            title={
              <Box sx={{ p: 0.5, fontSize: '0.78rem', lineHeight: 1.6 }}>
                <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  변동 기준: {prevTimeLabel ? `직전 수집 (${prevTimeLabel}) 대비` : '직전 수집 데이터 없음'}
                </Box>
                <Box>• <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>▲N</span> 직전 대비 N계단 상승</Box>
                <Box>• <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>▼N</span> 직전 대비 N계단 하락</Box>
                <Box>• <span style={{ color: '#9e9e9e' }}>–</span> 변동 없음</Box>
                <Box>• <span style={{ color: '#ff6f00', fontWeight: 'bold' }}>NEW</span> 최근 {windowParam} 내 신규 진입</Box>
              </Box>
            }
          >
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ cursor: 'help', color: 'text.secondary' }}>
              <InfoOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" noWrap>
                {prevTimeLabel ? `직전 수집 (${prevTimeLabel}) 대비` : '직전 수집 없음'}
              </Typography>
            </Stack>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">기간:</Typography>
          <ToggleButtonGroup
            size="small"
            value={windowParam}
            exclusive
            onChange={(_, v) => v && setWindowParam(v)}
          >
            <ToggleButton value="6h">6H</ToggleButton>
            <ToggleButton value="12h">12H</ToggleButton>
            <ToggleButton value="24h">24H</ToggleButton>
            <ToggleButton value="48h">48H</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* 이탈 슬림 배너 */}
      {dropouts.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            mb: 1.5,
            borderColor: '#f5c6cb',
            bgcolor: dropoutsExpanded ? '#fff8f8' : 'transparent',
            transition: 'background-color 0.15s'
          }}
        >
          <Box
            onClick={() => setDropoutsExpanded(v => !v)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.6,
              cursor: 'pointer',
              '&:hover': { bgcolor: '#fff0f0' }
            }}
          >
            <Typography variant="caption" sx={{ color: 'error.dark', fontWeight: 600, whiteSpace: 'nowrap' }}>
              📉 직전 수집 대비 이탈
            </Typography>
            <Chip
              size="small"
              label={`${dropouts.length}건`}
              sx={{ height: 18, fontSize: '0.7rem', bgcolor: '#ffe0e0', color: '#b71c1c', fontWeight: 'bold' }}
            />
            {!dropoutsExpanded && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  ml: 0.5, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', minWidth: 0, flex: 1
                }}
              >
                {dropouts.slice(0, 3).map(d => `${d.product_name || '?'} (${d.category_name})`).join(' · ')}
                {dropouts.length > 3 && ` 외 ${dropouts.length - 3}건`}
              </Typography>
            )}
            {prevTimeLabel && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>
                ({prevTimeLabel} 기준)
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {dropoutsExpanded ? '접기' : '보기'}
            </Typography>
            <IconButton size="small" sx={{ p: 0.25 }}>
              {dropoutsExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>
          <Collapse in={dropoutsExpanded}>
            <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>
              <Grid container spacing={1}>
                {dropouts.map((d) => (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={`${d.goods_no}|${d.category_id}`}>
                    <Box
                      onClick={() => openHistory(
                        { goods_no: d.goods_no, product_name: d.product_name, brand_name: null },
                        d.category_id
                      )}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, p: 0.8,
                        border: '1px solid #f5c6cb', borderRadius: 1, bgcolor: 'white',
                        cursor: 'pointer', height: '100%',
                        '&:hover': { boxShadow: 1, bgcolor: '#fefefe' }
                      }}
                    >
                      <Chip
                        size="small"
                        label={`${d.prevRank}위`}
                        sx={{
                          height: 22, minWidth: 40, fontSize: '0.72rem',
                          bgcolor: '#ffe0e0', color: '#b71c1c', fontWeight: 'bold',
                          flexShrink: 0
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={600} sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.3
                        }}>
                          {d.product_name || '(이름 없음)'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          {d.category_name}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Collapse>
        </Paper>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 메인 테이블 — 자사 제품 × 노출 카테고리 */}
      <Paper sx={{ position: 'relative' }}>
        {loading && exposed.length > 0 && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1 }} />
        )}
        {loading && !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : exposed.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>
              {summary.totalRegistered === 0
                ? '등록된 자사 제품이 없습니다. 캠페인의 제품 URL에 올리브영 goodsNo가 있는지 확인해주세요.'
                : `최근 ${windowHoursLabel} 동안 BEST 100에 노출된 제품이 없습니다.`}
            </Typography>
          </Box>
        ) : (
          <Table size="small" sx={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ width: 80, fontWeight: 'bold' }}>최고순위</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>노출 카테고리 / 순위 / 변동</TableCell>
                <TableCell sx={{ width: 100, fontWeight: 'bold' }}>{windowParam} 추이</TableCell>
                <TableCell sx={{ width: 130, fontWeight: 'bold' }}>상품 코드</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exposed.map((p) => {
                const bestRanking = p.rankings[0]; // currentlyExposed 우선 정렬됨
                // 윈도우 기간 내 진짜 최고순위 (best24h 중 최솟값)
                const windowBestRank = Math.min(...p.rankings.map(r => r.best24h));
                return (
                  <TableRow key={p.goods_no} hover>
                    <TableCell>
                      <Typography
                        variant="h6"
                        color={windowBestRank <= 3 ? 'error.main' : 'text.primary'}
                        sx={{ lineHeight: 1 }}
                      >
                        {windowBestRank}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {p.product_url ? (
                        <Link
                          href={p.product_url}
                          target="_blank"
                          rel="noopener"
                          underline="hover"
                          sx={{
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.35,
                            color: 'text.primary',
                            '&:hover': { color: 'primary.main' }
                          }}
                        >
                          {p.product_name || '(이름 없음)'}
                        </Link>
                      ) : (
                        <Typography sx={{
                          fontSize: '0.95rem',
                          fontWeight: 500,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.35
                        }}>
                          {p.product_name || '(이름 없음)'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                        {p.rankings.map((r) => {
                          const exposed = r.currentlyExposed;
                          const lastSeenLabel = !exposed && r.lastSeenAt
                            ? new Date(r.lastSeenAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : null;
                          return (
                            <Box
                              key={`${r.category_id}_${r.rank}`}
                              onClick={() => openHistory(p, r.category_id)}
                              title={!exposed ? `현재 라운드에는 100위 밖 · 마지막 노출 ${lastSeenLabel}` : undefined}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.4,
                                px: 0.8,
                                py: 0.3,
                                borderRadius: 1,
                                bgcolor: !exposed
                                  ? '#fafafa'
                                  : r.rank <= 10 ? '#ffebee' : r.rank <= 30 ? '#fff3e0' : '#f5f5f5',
                                border: '1px solid',
                                borderColor: !exposed
                                  ? '#e0e0e0'
                                  : r.rank <= 10 ? '#ffcdd2' : r.rank <= 30 ? '#ffe0b2' : '#e0e0e0',
                                borderStyle: !exposed ? 'dashed' : 'solid',
                                opacity: !exposed ? 0.7 : 1,
                                cursor: 'pointer',
                                '&:hover': { boxShadow: 1, bgcolor: 'white' }
                              }}
                            >
                              <Typography variant="caption" fontWeight={600}>
                                {r.category_name}
                              </Typography>
                              <Typography
                                variant="caption"
                                fontWeight="bold"
                                sx={{
                                  color: !exposed
                                    ? 'text.disabled'
                                    : r.rank <= 10 ? 'error.main' : r.rank <= 30 ? 'warning.main' : 'text.primary',
                                  textDecoration: !exposed ? 'line-through' : 'none'
                                }}
                              >
                                {r.rank}위
                              </Typography>
                              {!exposed && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', ml: 0.2 }}>
                                  이탈
                                </Typography>
                              )}
                              <Box sx={{ ml: 0.3 }}>
                                <RankChangeBadge
                                  delta={r.delta}
                                  prevRank={r.prevRank}
                                  isNew={r.isNew}
                                  currentRank={r.rank}
                                  prevTimeLabel={prevTimeLabel}
                                  windowHours={parseInt(windowParam, 10)}
                                />
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Tooltip
                        title={
                          bestRanking.samples24h > 0
                            ? `${bestRanking.category_name} ${windowParam} — 최고 ${bestRanking.best24h}위 · 최저 ${bestRanking.worst24h}위 · 평균 ${bestRanking.avg24h}위 (${bestRanking.samples24h}회 노출)`
                            : '추이 데이터 없음'
                        }
                      >
                        <Box>
                          <MiniSparkline points={bestRanking.trend} />
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {p.goods_no || '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* 자사 한정 인사이트 (4패널) */}
      {(insights.biggestGainers.length > 0 || insights.biggestLosers.length > 0 ||
        insights.newEntries.length > 0 || insights.consistent.length > 0) && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1.5 }}>
            자사 제품 인사이트 ({windowParam} 기준)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <BrandInsightPanel
                title="🚀 급상승"
                subtitle={`${windowParam} 내 순위가 가장 많이 오른 자사 제품`}
                color="#2e7d32"
                bgColor="#e8f5e9"
                items={insights.biggestGainers}
                emptyText="급상승한 자사 제품이 없습니다"
                renderMeta={(g) => (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={`▲${g.deltaFromStart}`}
                      sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#c8e6c9', color: '#1b5e20', fontWeight: 'bold' }}
                    />
                    <Chip
                      size="small"
                      label={`${g.category_name} · ${g.rankBefore}→${g.rankNow}위`}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Stack>
                )}
                onClick={(it) => openHistory(it, it.category_id)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <BrandInsightPanel
                title="📉 급하락"
                subtitle={`${windowParam} 내 순위가 가장 많이 떨어진 자사 제품`}
                color="#c62828"
                bgColor="#ffebee"
                items={insights.biggestLosers}
                emptyText="급하락한 자사 제품이 없습니다"
                renderMeta={(g) => (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={`▼${Math.abs(g.deltaFromStart)}`}
                      sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#ffcdd2', color: '#b71c1c', fontWeight: 'bold' }}
                    />
                    <Chip
                      size="small"
                      label={`${g.category_name} · ${g.rankBefore}→${g.rankNow}위`}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Stack>
                )}
                onClick={(it) => openHistory(it, it.category_id)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <BrandInsightPanel
                title="🆕 신규 진입"
                subtitle={`${windowParam} 내 새로 100위에 진입한 자사 제품`}
                color="#e65100"
                bgColor="#fff3e0"
                items={insights.newEntries}
                emptyText="신규 진입 자사 제품이 없습니다"
                renderMeta={(g) => {
                  const hoursAgo = Math.round((Date.now() - new Date(g.firstSeenAt).getTime()) / 3600000);
                  return (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label="NEW"
                        sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#ffe0b2', color: '#e65100', fontWeight: 'bold' }}
                      />
                      <Chip
                        size="small"
                        label={`${g.category_name} ${g.rankNow}위 · ${hoursAgo}h 전`}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Stack>
                  );
                }}
                onClick={(it) => openHistory(it, it.category_id)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <BrandInsightPanel
                title="👑 꾸준한 상위"
                subtitle={`${windowParam} 내 순위 변동이 거의 없는 자사 안정 제품 (변동 < 5위)`}
                color="#4527a0"
                bgColor="#ede7f6"
                items={insights.consistent}
                emptyText="꾸준한 자사 제품이 없습니다"
                renderMeta={(g) => (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={`평균 ${g.avgRank}위`}
                      sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#d1c4e9', color: '#311b92', fontWeight: 'bold' }}
                    />
                    <Chip
                      size="small"
                      label={`${g.category_name} · 변동 ±${g.range}`}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Stack>
                )}
                onClick={(it) => openHistory(it, it.category_id)}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* 미노출 자사 제품 (접기/펼치기) */}
      {notExposed.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 3 }}>
          <Box
            onClick={() => setNotExposedExpanded(v => !v)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8,
              cursor: 'pointer',
              '&:hover': { bgcolor: '#fafafa' }
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              미노출 자사 제품 ({notExposed.length}개) — 최근 {windowHoursLabel} 동안 한 번도 BEST 100 안에 들지 않음
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {notExposedExpanded ? '접기' : '보기'}
            </Typography>
            <IconButton size="small" sx={{ p: 0.25 }}>
              {notExposedExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>
          <Collapse in={notExposedExpanded}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                  <TableCell sx={{ width: 160, fontWeight: 'bold' }}>상품 코드</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notExposed.map((p) => (
                  <TableRow key={p.goods_no}>
                    <TableCell>{p.product_name || '(이름 없음)'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.goods_no}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Collapse>
        </Paper>
      )}

      {/* 추이 모달 (Admin 컴포넌트 그대로 재사용) */}
      <RankingHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        product={historyProduct}
        categoryId={historyCategoryId}
      />
      </Container>
    </Box>
  );
}

// 요약 KPI 카드
function SummaryCard({ label, value, unit, color, hint }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Stack direction="row" alignItems="baseline" spacing={0.5}>
        <Typography variant="h4" fontWeight="bold" sx={{ color, lineHeight: 1.1 }}>
          {value.toLocaleString()}
        </Typography>
        <Typography variant="body2" color="text.secondary">{unit}</Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {hint}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

// 자사 한정 인사이트 패널 (Admin RankingInsightsTab과 다르게 카테고리 정보 포함)
function BrandInsightPanel({ title, subtitle, color, bgColor, items, emptyText, renderMeta, onClick }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
      <Box sx={{ pb: 1, mb: 1, borderBottom: '1px solid #eee' }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ color }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      </Box>
      {items.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">{emptyText}</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {items.map((item) => (
            <Tooltip
              key={`${item.goods_no}|${item.category_id}`}
              title="클릭하면 시간별 순위 추이를 볼 수 있습니다"
              placement="left"
            >
              <Box
                onClick={() => onClick && onClick(item)}
                sx={{
                  display: 'flex', flexDirection: 'column', gap: 0.4, p: 1, borderRadius: 1,
                  cursor: 'pointer', bgcolor: bgColor,
                  '&:hover': { bgcolor: '#fafafa', boxShadow: 1 }
                }}
              >
                <Typography variant="body2" fontWeight="bold" sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.3
                }}>
                  {item.product_name || '(이름 없음)'}
                </Typography>
                <Box>{renderMeta(item)}</Box>
              </Box>
            </Tooltip>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export default BrandRankingView;
