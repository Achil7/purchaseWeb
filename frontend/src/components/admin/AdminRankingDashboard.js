import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Box, Container, Typography, Tabs, Tab, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Chip, Alert, CircularProgress, Link, Stack,
  Button, LinearProgress, Tooltip, Snackbar, ToggleButtonGroup, ToggleButton, Grid,
  Switch, FormControlLabel, TextField
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { downloadExcel } from '../../utils/excelExport';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { rankingService } from '../../services';
import RankingHistoryDialog from './RankingHistoryDialog';
import RankingInsightsTab from './RankingInsightsTab';

export function formatElapsed(ms) {
  if (!ms || ms < 0) return '0초';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}초`;
  return `${min}분 ${sec}초`;
}

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

/**
 * 변동 배지: 직전 시점 대비 순위 변화
 *  - prevTimeLabel: Tooltip에 표시할 직전 수집 시각 (예: "15:01")
 *  - currentRank, windowHours: Tooltip 문구 생성용
 */
export function RankChangeBadge({ delta, prevRank, isNew, prevTimeLabel, currentRank, windowHours }) {
  if (isNew) {
    return (
      <Tooltip title={`최근 ${windowHours || 24}시간 내 100위 안에 처음 등장`}>
        <Chip
          size="small"
          label="NEW"
          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold', bgcolor: '#ff6f00', color: 'white' }}
        />
      </Tooltip>
    );
  }
  if (prevRank === null || delta === null) {
    return (
      <Tooltip title="직전 수집 시점에 100위 밖이었습니다">
        <Typography variant="caption" color="text.disabled">-</Typography>
      </Tooltip>
    );
  }
  if (delta === 0) {
    return (
      <Tooltip title={prevTimeLabel ? `직전 수집(${prevTimeLabel}) 대비 변동 없음 (${prevRank}위 유지)` : '변동 없음'}>
        <Typography variant="caption" color="text.disabled">–</Typography>
      </Tooltip>
    );
  }
  const isUp = delta > 0;
  const big = Math.abs(delta) >= 10;
  const tooltipText = prevTimeLabel
    ? `직전 수집(${prevTimeLabel}) ${prevRank}위 → 현재 ${currentRank}위 (${Math.abs(delta)}계단 ${isUp ? '상승' : '하락'})`
    : `${prevRank}위 → ${currentRank}위 (${Math.abs(delta)}계단 ${isUp ? '상승' : '하락'})`;
  return (
    <Tooltip title={tooltipText}>
      <Typography
        variant="caption"
        sx={{
          color: isUp ? 'success.main' : 'error.main',
          fontWeight: big ? 'bold' : 'normal',
          fontSize: big ? '0.85rem' : '0.75rem',
          cursor: 'help'
        }}
      >
        {isUp ? '▲' : '▼'}{Math.abs(delta)}
      </Typography>
    </Tooltip>
  );
}

/**
 * 미니 스파크라인 — 부모로부터 받은 points로 즉시 렌더 (fetch 없음)
 * points: [{ t: ISO, r: rank }, ...] (시간순 정렬, 윈도우 내 데이터)
 */
export const MiniSparkline = React.memo(function MiniSparkline({ points }) {
  if (!points || points.length < 2) {
    return <Typography variant="caption" color="text.disabled">–</Typography>;
  }
  // Y축 invert (1위가 위, 100위가 아래) → 101 - rank
  const chartData = points.map(p => ({ y: 101 - p.r }));

  return (
    <Box sx={{ width: 80, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="y"
            stroke="#1976d2"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
});

function AdminRankingDashboard() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [collectedAt, setCollectedAt] = useState(null);
  const [rankings, setRankings] = useState([]); // 변동 정보 포함된 current 배열 (rank, delta, prevRank, isNew, best24h, ...)
  const [dropouts, setDropouts] = useState([]);
  const [previousCollectedAt, setPreviousCollectedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 이탈 섹션 접기/펼치기 (세션 동안 유지) — 기본 접힘
  const [dropoutsExpanded, setDropoutsExpanded] = useState(false);

  // 상위 탭: 'current' | 'insights'
  const [mainView, setMainView] = useState('current');
  // 시간 창
  const [windowParam, setWindowParam] = useState('24h');

  // 과거 시점 조회 (Admin 전용)
  // - pastMode: 토글
  // - pastTimestamp: 'YYYY-MM-DDTHH:00' 형태 (datetime-local input 값, 시 단위)
  const [pastMode, setPastMode] = useState(false);
  const initialPastTs = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - 1);            // 한 시간 전 기본값
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:00`;
  }, []);
  const [pastTimestamp, setPastTimestamp] = useState(initialPastTs);

  // 추이 모달
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);

  const [progress, setProgress] = useState({ job: { running: false }, lastCollectedAt: null, scheduler: null, lastJob: null, cacheActive: false });
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const [completionToast, setCompletionToast] = useState(null); // {severity, text, autoHide}
  const [, setTickCounter] = useState(0); // 경과시간 1초 갱신용
  const pollRef = useRef(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await rankingService.getCategories();
      if (res.success) setCategories(res.data || []);
    } catch (err) {
      console.error('카테고리 로드 실패:', err);
    }
  }, []);

  const loadRankings = useCallback(async (categoryId, win = windowParam, baseTs = null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await rankingService.getChanges(categoryId, win, baseTs);
      if (res.success) {
        setCollectedAt(res.data.currentCollectedAt);
        setPreviousCollectedAt(res.data.previousCollectedAt);
        setRankings(res.data.current || []);
        setDropouts(res.data.dropouts || []);
      } else {
        setError(res.message || '데이터를 불러오지 못했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [windowParam]);

  // 엑셀 다운로드
  // - 화면에 보이는 현재 카테고리 100위만 다운 (순위/제품명/브랜드/가격/상품코드)
  // - 과거 시점 모드일 때는 그 시점 데이터로 다운 (rankings state가 이미 그 시점 데이터)
  const handleExportExcel = useCallback(() => {
    if (!rankings || rankings.length === 0) return;

    const categoryName = categories.find((c) => c.id === activeCategory)?.name || activeCategory;
    const headers = ['순위', '제품명', '브랜드', '가격', '상품코드'];
    const rows = rankings.map((r) => [
      r.rank,
      r.product_name || '',
      r.brand_name || '',
      r.sale_price || r.original_price || r.price || '',
      r.goods_no || ''
    ]);
    const data = [headers, ...rows];

    // 파일명: 카테고리 + (과거 모드면 그 시점 / 현재 모드면 collected_at)
    const ts = collectedAt ? new Date(collectedAt) : new Date();
    const z = (n) => String(n).padStart(2, '0');
    const tsLabel = `${ts.getFullYear()}${z(ts.getMonth() + 1)}${z(ts.getDate())}_${z(ts.getHours())}${z(ts.getMinutes())}`;
    const modeLabel = pastMode ? '과거시점' : '실시간';
    const fileName = `올리브영랭킹_${categoryName}_${modeLabel}_${tsLabel}`;

    downloadExcel(data, fileName, categoryName, false);
  }, [rankings, categories, activeCategory, collectedAt, pastMode]);

  // 직전 수집 시각 라벨 (Tooltip / legend 표시용)
  // - 정상이면 "15:01" 형태 (시:분)
  // - 비정상(예: 3시간 차이)이면 "06:14 (3시간 전)" 형태로 명시
  const prevTimeLabel = (() => {
    if (!previousCollectedAt) return null;
    const prev = new Date(previousCollectedAt);
    const cur = collectedAt ? new Date(collectedAt) : new Date();
    const diffMs = cur.getTime() - prev.getTime();
    const diffH = Math.round(diffMs / (3600 * 1000));
    const timeStr = prev.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    // 1시간 차이면 그냥 시각만, 2시간 이상이면 "(N시간 전)" 명시
    if (diffH >= 2) return `${timeStr} (${diffH}시간 전)`;
    return timeStr;
  })();

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
        const meta = res.jobMeta || {};
        const completed = meta.completed || 0;
        const total = meta.total || 21;
        const elapsedText = meta.elapsedMs ? formatElapsed(meta.elapsedMs) : null;
        const parts = [`이미 수집 중인 작업이 있습니다 (${completed}/${total} 완료`];
        if (elapsedText) parts.push(`, ${elapsedText} 경과`);
        parts.push('). 아래에서 진행 상황을 확인하세요.');
        setTriggerMsg({ severity: 'warning', text: parts.join('') });
      } else if (res.status === 'cooldown') {
        setTriggerMsg({ severity: 'warning', text: `너무 빠른 연타입니다. ${res.remainSec}초 후 다시 시도해주세요.` });
      } else if (res.status === 'hourly_limit') {
        setTriggerMsg({ severity: 'error', text: `최근 1시간 내 ${res.limit}회 한도를 모두 사용했습니다.` });
      } else if (res.status === 'ip_blocked') {
        setTriggerMsg({ severity: 'error', text: '비정상적 호출이 감지되어 일시 차단되었습니다. 약 1시간 후 다시 시도해주세요.' });
      } else if (res.status === 'proxy_disabled') {
        setTriggerMsg({ severity: 'warning', text: '프록시가 OFF 상태입니다. .env의 PROXY_ENABLED=true 로 변경하면 자동 반영됩니다.' });
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

  // 현재 적용된 baseTs (과거 모드 ON 일 때만)
  const effectiveBaseTs = pastMode && pastTimestamp
    ? new Date(pastTimestamp).toISOString()
    : null;

  useEffect(() => {
    if (activeCategory) loadRankings(activeCategory, windowParam, effectiveBaseTs);
  }, [activeCategory, windowParam, effectiveBaseTs, loadRankings]);

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

  // 수집 완료 시 자동 새로고침 + 익명 토스트 알림
  const prevRunningRef = useRef(false);
  const seenLastJobIdRef = useRef(null);
  useEffect(() => {
    if (prevRunningRef.current && !progress.job?.running) {
      // 방금 완료됨 → 현재 카테고리 다시 로드 (과거 모드면 변경 X — 그 시점 데이터는 변하지 않음)
      if (activeCategory && !effectiveBaseTs) loadRankings(activeCategory, windowParam, null);
      // 익명 토스트 알림 (lastJob 기반)
      const lastJob = progress.lastJob;
      if (lastJob && lastJob.id !== seenLastJobIdRef.current) {
        seenLastJobIdRef.current = lastJob.id;
        const dur = lastJob.duration_ms ? formatElapsed(lastJob.duration_ms) : '-';
        const succ = lastJob.success_count || 0;
        const fail = lastJob.fail_count || 0;
        const total = lastJob.total_categories || 21;
        const failedList = (lastJob.failed_categories && lastJob.failed_categories.length > 0)
          ? lastJob.failed_categories.join(', ')
          : null;
        if (lastJob.status === 'failed') {
          const txt = failedList
            ? `수집 실패 — 실패: ${failedList}`
            : '수집 실패 — 잠시 후 다시 시도해주세요';
          setCompletionToast({ severity: 'error', text: txt, autoHide: null });
        } else if (fail > 0) {
          const txt = failedList
            ? `수집 부분 완료 — 성공 ${succ}/${total} (실패: ${failedList}) · ${dur} 소요`
            : `수집 부분 완료 — 성공 ${succ}/${total} · ${dur} 소요`;
          setCompletionToast({ severity: 'warning', text: txt, autoHide: 8000 });
        } else {
          setCompletionToast({ severity: 'success', text: `수집 완료 (${succ}개 카테고리) — ${dur} 소요`, autoHide: 5000 });
        }
      }
    }
    prevRunningRef.current = !!progress.job?.running;
  }, [progress.job?.running, progress.lastJob, activeCategory, loadRankings, windowParam, effectiveBaseTs]);

  // 진행 중일 때만 경과시간 1초마다 갱신 (job.startedAt 기반 클라이언트 계산용)
  useEffect(() => {
    if (!progress.job?.running) return;
    const id = setInterval(() => setTickCounter(t => (t + 1) % 100000), 1000);
    return () => clearInterval(id);
  }, [progress.job?.running]);

  // 첫 진입 시 이미 lastJob이 있어도 토스트 띄우지 않도록 초기화
  useEffect(() => {
    if (progress.lastJob && seenLastJobIdRef.current === null) {
      seenLastJobIdRef.current = progress.lastJob.id;
    }
  }, [progress.lastJob]);

  const job = progress.job || { running: false };
  const schedulerNextAt = progress.scheduler?.nextRunAt;
  const proxyEnabled = progress.scheduler?.proxyEnabled;

  // 최근 라운드 실패 카테고리 (탭 ⚠️ 표시용)
  const lastFailedCategoryNames = useMemo(() => {
    return new Set(progress.lastJob?.failed_categories || []);
  }, [progress.lastJob?.failed_categories]);
  const lastJobCompletedLabel = progress.lastJob?.completed_at
    ? new Date(progress.lastJob.completed_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
  // 현재 선택된 카테고리가 최근 라운드에서 실패했는지
  const activeCategoryName = categories.find(c => c.id === activeCategory)?.name;
  const activeCategoryFailedLast = activeCategoryName && lastFailedCategoryNames.has(activeCategoryName);

  return (
    <Container maxWidth="xl" sx={{ pt: 12, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold">올리브영 카테고리 BEST 랭킹</Typography>
        <Box sx={{ flexGrow: 1 }} />
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: 2.5, mb: 2,
          bgcolor: pastMode ? '#fff7ed' : '#f0f7ff',
          borderColor: pastMode ? 'warning.main' : undefined
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          {/* 좌측: 기준 시각 (현재 모드 = 최근 수집, 과거 모드 = 매칭된 라운드) */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.3 }}>
              {pastMode ? '과거 시점 기준 (매칭된 수집 라운드)' : '최근 수집 시각'}
            </Typography>
            <Typography
              variant="h5"
              fontWeight="bold"
              sx={{ color: collectedAt ? (pastMode ? 'warning.main' : 'primary.main') : 'text.disabled', lineHeight: 1.1 }}
            >
              {collectedAt ? new Date(collectedAt).toLocaleString('ko-KR') : '데이터 없음'}
            </Typography>
            {pastMode && pastTimestamp && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                요청한 시점: {new Date(pastTimestamp).toLocaleString('ko-KR')}
              </Typography>
            )}
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
            {progress.cacheActive && !job.running && (
              <Tooltip title="최근 수집이 캐시 범위(30분) 이내라서 새 수집을 안 합니다. 강제 새 수집은 가능합니다.">
                <Chip
                  label="캐시 활용 중"
                  color="info"
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
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
            <Tooltip title={proxyEnabled === false ? '프록시 OFF 상태에서는 수집할 수 없습니다' : '30분 이내 데이터가 있으면 즉시 표시, 없으면 새로 수집'}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<CloudSyncIcon />}
                  onClick={() => handleTrigger(false)}
                  disabled={triggering || job.running || proxyEnabled === false}
                >
                  {job.running ? '수집 중...' : '지금 수집'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={proxyEnabled === false ? '프록시 OFF 상태에서는 수집할 수 없습니다' : '항상 새로 수집'}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleTrigger(true)}
                  disabled={triggering || job.running || proxyEnabled === false}
                >
                  강제 새 수집
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={pastMode ? '과거 시점 기준 100위를 엑셀로 다운로드' : '현재 표시된 100위를 엑셀로 다운로드'}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  color="success"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExportExcel}
                  disabled={!rankings || rankings.length === 0}
                >
                  엑셀 다운
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
              {!job.proxyEnabled && (
                <Chip size="small" label="프록시 OFF" color="warning" variant="outlined" sx={{ height: 22 }} />
              )}
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
            {Array.isArray(job.failedCategories) && job.failedCategories.length > 0 && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'warning.main' }}>
                ⚠️ 재시도 중: {job.failedCategories.join(', ')}
              </Typography>
            )}
          </Paper>
        );
      })()}

      {/* 최근 라운드 실패 카테고리 (수집 중이 아닐 때만) */}
      {!job.running && progress.lastJob && Array.isArray(progress.lastJob.failed_categories) && progress.lastJob.failed_categories.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.3 }}>
            최근 라운드 실패 카테고리 ({progress.lastJob.failed_categories.length}개)
          </Typography>
          <Typography variant="body2">
            {progress.lastJob.failed_categories.join(', ')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            다음 자동 수집에서 다시 시도됩니다.
          </Typography>
        </Alert>
      )}

      {/* 상위 탭: 현재 순위 / 인사이트 + 시간 창 토글 */}
      <Paper sx={{ mb: 2, p: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Tabs
          value={mainView}
          onChange={(_, v) => setMainView(v)}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: '0.9rem', fontWeight: 600 } }}
        >
          <Tab value="current" label="현재 순위" />
          <Tab value="insights" label="인사이트" />
        </Tabs>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">기간:</Typography>
            <ToggleButtonGroup
              size="small"
              value={windowParam}
              exclusive
              onChange={(_, v) => v && setWindowParam(v)}
            >
              <ToggleButton value="6h">6h</ToggleButton>
              <ToggleButton value="12h">12h</ToggleButton>
              <ToggleButton value="24h">24h</ToggleButton>
              <ToggleButton value="48h">48h</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {/* 과거 시점 조회 (시 단위) */}
          <Stack direction="row" spacing={1} alignItems="center"
            sx={{
              px: 1.2, py: 0.6, borderRadius: 1,
              border: pastMode ? '1px solid #ed6c02' : '1px solid #e0e0e0',
              bgcolor: pastMode ? '#fff7ed' : 'transparent'
            }}
          >
            <Tooltip title="OFF: 실시간(최신). ON: 입력한 과거 시점 기준으로 랭킹/변동/추이를 표시합니다.">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={pastMode}
                    onChange={(_, v) => setPastMode(v)}
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <HistoryIcon fontSize="small" sx={{ color: pastMode ? 'warning.main' : 'text.secondary' }} />
                    <Typography variant="caption" color={pastMode ? 'warning.main' : 'text.secondary'} fontWeight={pastMode ? 'bold' : 'normal'}>
                      과거 시점
                    </Typography>
                  </Stack>
                }
                sx={{ mr: 0.5 }}
              />
            </Tooltip>
            <TextField
              type="datetime-local"
              size="small"
              value={pastTimestamp}
              onChange={(e) => {
                // 시 단위로만 받기 (분/초 0으로)
                const v = e.target.value;
                if (!v) { setPastTimestamp(''); return; }
                // YYYY-MM-DDTHH:MM 에서 분을 00으로 강제
                const idx = v.lastIndexOf(':');
                const normalized = idx > 0 ? v.slice(0, idx) + ':00' : v;
                setPastTimestamp(normalized);
              }}
              disabled={!pastMode}
              inputProps={{ step: 3600 }}             // 1시간 단위
              sx={{ width: 200 }}
            />
          </Stack>
        </Stack>
      </Paper>

      {/* 카테고리 탭 (두 view 공통) */}
      <Paper sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tabs
            value={activeCategory}
            onChange={(_, v) => setActiveCategory(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {categories.map((c) => {
              const isFailedLast = lastFailedCategoryNames.has(c.name);
              return (
                <Tab
                  key={c.id}
                  value={c.id}
                  label={
                    isFailedLast ? (
                      <Tooltip title={`최근 수집(${lastJobCompletedLabel || ''})에서 이 카테고리는 실패했습니다. 표시 데이터는 그 이전 라운드 기준입니다.`}>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                          <span style={{ color: '#ed6c02', fontWeight: 700 }}>⚠️</span>
                          <span>{c.name}</span>
                        </Box>
                      </Tooltip>
                    ) : c.name
                  }
                />
              );
            })}
          </Tabs>
        </Box>
        {/* 우측 inline 변동 기준 안내 (현재 순위 탭에서만) */}
        {mainView === 'current' && (
          <Tooltip
            arrow
            placement="bottom-end"
            title={
              <Box sx={{ p: 0.5, fontSize: '0.78rem', lineHeight: 1.6 }}>
                <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  변동 기준: {prevTimeLabel ? `직전 수집 (${prevTimeLabel}) 대비` : '직전 수집 데이터 없음'}
                </Box>
                <Box>• <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>▲N</span> 직전 대비 N계단 상승</Box>
                <Box>• <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>▼N</span> 직전 대비 N계단 하락</Box>
                <Box>• <span style={{ color: '#9e9e9e' }}>–</span> 변동 없음</Box>
                <Box>• <span style={{ color: '#ff6f00', fontWeight: 'bold' }}>NEW</span> 최근 {windowParam} 내 신규 진입</Box>
                <Box sx={{ mt: 0.5, color: '#bdbdbd', fontSize: '0.72rem' }}>
                  ※ 추이 차트와 NEW 칩의 시간 범위는 우측 상단 "기간"으로 조절
                </Box>
              </Box>
            }
          >
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{
                px: 1.5, mr: 1, cursor: 'help', flexShrink: 0,
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' }
              }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" noWrap>
                {prevTimeLabel ? `직전 수집 (${prevTimeLabel}) 대비` : '직전 수집 없음'}
              </Typography>
            </Stack>
          </Tooltip>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* 현재 선택한 카테고리가 최근 라운드에서 실패한 경우 명시 알림 */}
      {activeCategoryFailedLast && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<span style={{ fontSize: '1.1rem' }}>⚠️</span>}>
          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.3 }}>
            "{activeCategoryName}" 카테고리는 최근 라운드 수집에 실패했습니다
          </Typography>
          <Typography variant="body2">
            현재 표시되는 데이터는 이 카테고리가 마지막으로 성공한 라운드의 데이터입니다 ({collectedAt ? new Date(collectedAt).toLocaleString('ko-KR') : '-'} 기준).
            <br />
            다음 자동 수집에서 다시 시도됩니다.
          </Typography>
        </Alert>
      )}

      {mainView === 'current' ? (
        <>
          {/* 이탈 슬림 알림 바 — 한 줄, 기본 접힘, 클릭 시 인라인 확장 */}
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
                  📉 100위 이탈
                </Typography>
                <Chip
                  size="small"
                  label={`${dropouts.length}개`}
                  sx={{ height: 18, fontSize: '0.7rem', bgcolor: '#ffe0e0', color: '#b71c1c', fontWeight: 'bold' }}
                />
                {/* 접혔을 때 첫 몇 개 제품명 미리보기 (텍스트만) */}
                {!dropoutsExpanded && dropouts.length > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      ml: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      flex: 1
                    }}
                  >
                    {dropouts.slice(0, 3).map(d => d.product_name).filter(Boolean).join(' · ')}
                    {dropouts.length > 3 && ` 외 ${dropouts.length - 3}개`}
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
                      <Grid item xs={6} sm={4} md={3} lg={2} key={d.goods_no}>
                        <Box
                          onClick={() => {
                            setHistoryProduct(d);
                            setHistoryOpen(true);
                          }}
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
                          <Typography variant="caption" fontWeight={500} sx={{
                            flex: 1, minWidth: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.3
                          }}>
                            {d.product_name || '(이름 없음)'}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Collapse>
            </Paper>
          )}

          <Paper sx={{ position: 'relative' }}>
            {/* 부드러운 로딩: 기존 데이터 유지, 상단에 LinearProgress */}
            {loading && rankings.length > 0 && (
              <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1 }} />
            )}
            {loading && rankings.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : rankings.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>이 카테고리에 수집된 데이터가 없습니다.</Typography>
              </Box>
            ) : (
              <Table size="small" sx={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ width: 90, fontWeight: 'bold' }}>순위</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                    <TableCell sx={{ width: 140, fontWeight: 'bold' }}>브랜드</TableCell>
                    <TableCell sx={{ width: 140, fontWeight: 'bold' }}>가격</TableCell>
                    <TableCell sx={{ width: 100, fontWeight: 'bold' }}>{windowParam} 추이</TableCell>
                    <TableCell sx={{ width: 130, fontWeight: 'bold' }}>상품 코드</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rankings.map((r) => {
                    const statsTooltip = r.samples24h > 0
                      ? `${windowParam} 기준 — 최고 ${r.best24h}위 · 최저 ${r.worst24h}위 · 평균 ${r.avg24h}위 (${r.samples24h}회 노출)`
                      : '추이 데이터 없음';
                    return (
                      <TableRow
                        key={r.id}
                        hover
                        onClick={() => {
                          if (!r.goods_no) return;
                          setHistoryProduct(r);
                          setHistoryOpen(true);
                        }}
                        sx={{ cursor: r.goods_no ? 'pointer' : 'default' }}
                      >
                        <TableCell>
                          <Stack direction="column" spacing={0.2} alignItems="flex-start">
                            <Typography variant="h6" color={r.rank <= 3 ? 'error.main' : 'text.primary'} sx={{ lineHeight: 1 }}>
                              {r.rank}
                            </Typography>
                            <RankChangeBadge
                              delta={r.delta}
                              prevRank={r.prevRank}
                              isNew={r.isNew}
                              currentRank={r.rank}
                              prevTimeLabel={prevTimeLabel}
                              windowHours={parseInt(windowParam, 10)}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          {r.product_url ? (
                            <Link
                              href={r.product_url}
                              target="_blank"
                              rel="noopener"
                              underline="hover"
                              onClick={(e) => e.stopPropagation()}
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
                              {r.product_name || '(이름 없음)'}
                            </Link>
                          ) : (
                            <Typography
                              sx={{
                                fontSize: '0.95rem',
                                fontWeight: 500,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                lineHeight: 1.35
                              }}
                            >
                              {r.product_name || '(이름 없음)'}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{r.brand_name || '-'}</TableCell>
                        <TableCell><PriceCell row={r} /></TableCell>
                        <TableCell>
                          <Tooltip title={statsTooltip}>
                            <Box>
                              <MiniSparkline points={r.trend} />
                            </Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{r.goods_no || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Paper>

        </>
      ) : (
        <RankingInsightsTab
          categoryId={activeCategory}
          windowParam={windowParam}
          onProductClick={(product) => {
            setHistoryProduct(product);
            setHistoryOpen(true);
          }}
        />
      )}

      <RankingHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        product={historyProduct}
        categoryId={activeCategory}
      />

      {/* 익명 완료/실패 토스트 */}
      <Snackbar
        open={!!completionToast}
        autoHideDuration={completionToast?.autoHide || null}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setCompletionToast(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {completionToast ? (
          <Alert
            severity={completionToast.severity}
            variant="filled"
            onClose={() => setCompletionToast(null)}
            sx={{ width: '100%' }}
          >
            {completionToast.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Container>
  );
}

export default AdminRankingDashboard;
