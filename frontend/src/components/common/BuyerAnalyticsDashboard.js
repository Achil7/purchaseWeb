import React, { useState, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, MenuItem, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  TablePagination,
  Chip, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import { buyerAnalyticsService } from '../../services';

const TOP_N_OPTIONS = [5, 10, 20, 50];

const REVIEW_STATUS_LABEL = {
  in_time: { label: '기한 내', color: 'success' },
  overdue_late: { label: '늦은 제출', color: 'warning' },
  overdue_pending: { label: '기한 초과 미제출', color: 'error' },
  in_progress: { label: '진행 중', color: 'default' },
  unknown: { label: '미입력', color: 'default' }
};

function fmtPct(n) {
  if (!isFinite(n)) return '-';
  return `${n.toFixed(1)}%`;
}

function fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('ko-KR', { hour12: false });
  } catch {
    return '-';
  }
}

function BuyerAnalyticsDashboard() {
  // 필터 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overdueDays, setOverdueDays] = useState(14);
  const [overdueThreshold, setOverdueThreshold] = useState(1); // M회 이상 기한 초과 (Worst 탭 필터)
  const [minParticipation, setMinParticipation] = useState(3);
  const [topN, setTopN] = useState(10);

  // 데이터
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);

  // 상세 dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(0);
  const [detailRowsPerPage, setDetailRowsPerPage] = useState(50);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        overdueDays,
        minParticipation
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await buyerAnalyticsService.getAccounts(params);
      setAccounts(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || '조회 실패');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, overdueDays, minParticipation]);

  const openDetail = useCallback(async (account) => {
    setDetailAccount(account);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRows([]);
    setDetailPage(0);
    try {
      const res = await buyerAnalyticsService.getAccountBuyers(account.account_normalized, { overdueDays });
      setDetailRows(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || '상세 조회 실패');
    } finally {
      setDetailLoading(false);
    }
  }, [overdueDays]);

  // 탭별 정렬/필터링
  const enrichedAccounts = useMemo(() => {
    return accounts.map(a => {
      const total = Number(a.total) || 0;
      const completed = Number(a.completed) || 0;
      const inTime = Number(a.in_time) || 0;
      const overdueLate = Number(a.overdue_late) || 0;
      const overduePending = Number(a.overdue_pending) || 0;
      const noShipOnly = Number(a.no_ship_only) || 0;
      const realShipOnly = Number(a.real_ship_only) || 0;
      return {
        ...a,
        _total: total,
        _completed: completed,
        _inTime: inTime,
        _overdueLate: overdueLate,
        _overduePending: overduePending,
        _overdueTotal: overdueLate + overduePending,
        _noShipOnly: noShipOnly,
        _realShipOnly: realShipOnly,
        _completionRate: total > 0 ? (completed / total) * 100 : 0
      };
    });
  }, [accounts]);

  const worstCompletion = useMemo(() => {
    return [...enrichedAccounts]
      .sort((a, b) => a._completionRate - b._completionRate || b._total - a._total)
      .slice(0, topN);
  }, [enrichedAccounts, topN]);

  const bestInTime = useMemo(() => {
    return [...enrichedAccounts]
      .filter(a => a._inTime > 0)
      .sort((a, b) => b._inTime - a._inTime || b._completionRate - a._completionRate)
      .slice(0, topN);
  }, [enrichedAccounts, topN]);

  const worstOverdue = useMemo(() => {
    return [...enrichedAccounts]
      .filter(a => a._overdueTotal >= overdueThreshold)
      .sort((a, b) => b._overdueTotal - a._overdueTotal || a._completionRate - b._completionRate)
      .slice(0, topN);
  }, [enrichedAccounts, overdueThreshold, topN]);

  const noShipOnlyAccounts = useMemo(() => {
    return [...enrichedAccounts]
      .filter(a => a._noShipOnly > 0 && a._realShipOnly === 0)
      .sort((a, b) => b._total - a._total)
      .slice(0, topN);
  }, [enrichedAccounts, topN]);

  const realShipOnlyAccounts = useMemo(() => {
    return [...enrichedAccounts]
      .filter(a => a._realShipOnly > 0 && a._noShipOnly === 0)
      .sort((a, b) => b._total - a._total)
      .slice(0, topN);
  }, [enrichedAccounts, topN]);

  const renderAccountsTable = (rows) => (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
      <Table size="small">
        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
          <TableRow>
            <TableCell>계좌(원본)</TableCell>
            <TableCell align="right">총 참여</TableCell>
            <TableCell align="right">완료</TableCell>
            <TableCell align="right">완료율</TableCell>
            <TableCell align="right">기한 내</TableCell>
            <TableCell align="right">기한 초과</TableCell>
            <TableCell align="right">미출고 횟수</TableCell>
            <TableCell align="right">실출고 횟수</TableCell>
            <TableCell align="center">상세</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={9} align="center" sx={{ color: 'text.secondary' }}>데이터 없음</TableCell></TableRow>
          ) : rows.map(r => (
            <TableRow key={r.account_normalized} hover>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Tooltip title={r.account_info || ''}>
                  <span>{r.account_info || r.account_normalized}</span>
                </Tooltip>
              </TableCell>
              <TableCell align="right">{r._total}</TableCell>
              <TableCell align="right">{r._completed}</TableCell>
              <TableCell align="right">{fmtPct(r._completionRate)}</TableCell>
              <TableCell align="right">{r._inTime}</TableCell>
              <TableCell align="right">
                {r._overdueTotal > 0 ? (
                  <Chip size="small" label={`${r._overdueTotal} (늦음 ${r._overdueLate} + 미제출 ${r._overduePending})`} color="error" variant="outlined" />
                ) : '0'}
              </TableCell>
              <TableCell align="right">{r._noShipOnly}</TableCell>
              <TableCell align="right">{r._realShipOnly}</TableCell>
              <TableCell align="center">
                <IconButton size="small" onClick={() => openDetail(r)}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
        구매자 분석 (계좌주 기반)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        동일 계좌번호(account_normalized)를 가진 구매자를 한 명으로 묶어 리뷰 제출 패턴과 출고유형 편중을 분석합니다.
        가명(구매자명/수취인명)이 달라도 같은 계좌면 동일인으로 집계됩니다.
      </Typography>

      {/* 필터 카드 */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          시작일/종료일은 <b>구매자 시트에 주문번호가 처음 입력된 시점</b> 기준입니다. 이 기간에 등록된 구매자만 분석합니다. 비워두면 전체 기간 조회.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            label="시작일 (주문번호 입력일)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            label="종료일 (주문번호 입력일)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            label="기한(일)"
            type="number"
            value={overdueDays}
            onChange={(e) => setOverdueDays(Math.max(1, parseInt(e.target.value, 10) || 14))}
            size="small"
            sx={{ width: 100 }}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="기한 초과 M회 이상"
            type="number"
            value={overdueThreshold}
            onChange={(e) => setOverdueThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
            size="small"
            sx={{ width: 140 }}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="최소 참여 건수"
            type="number"
            value={minParticipation}
            onChange={(e) => setMinParticipation(Math.max(1, parseInt(e.target.value, 10) || 1))}
            size="small"
            sx={{ width: 130 }}
            inputProps={{ min: 1 }}
          />
          <TextField
            select
            label="Top N"
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            size="small"
            sx={{ width: 100 }}
          >
            {TOP_N_OPTIONS.map(n => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? '조회 중...' : '조회'}
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 요약 */}
      {!loading && accounts.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Paper variant="outlined" sx={{ p: 1.5, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">분석 대상 계좌</Typography>
            <Typography variant="h6">{accounts.length.toLocaleString()}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">전체 참여 buyer</Typography>
            <Typography variant="h6">
              {enrichedAccounts.reduce((s, a) => s + a._total, 0).toLocaleString()}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">평균 완료율</Typography>
            <Typography variant="h6">
              {fmtPct(
                enrichedAccounts.length > 0
                  ? enrichedAccounts.reduce((s, a) => s + a._completionRate, 0) / enrichedAccounts.length
                  : 0
              )}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* 탭 */}
      <Paper variant="outlined">
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="완료율 낮은 순" />
          <Tab label="기한 내 제출 많은 순" />
          <Tab label="기한 초과 많은 순" />
          <Tab label="출고 편중자" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
          ) : (
            <>
              {tab === 0 && renderAccountsTable(worstCompletion)}
              {tab === 1 && renderAccountsTable(bestInTime)}
              {tab === 2 && renderAccountsTable(worstOverdue)}
              {tab === 3 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    미출고에만 참여 (실출고 0건) — 참여 횟수 많은 순
                  </Typography>
                  {renderAccountsTable(noShipOnlyAccounts)}
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 3, mb: 1 }}>
                    실출고에만 참여 (미출고 0건) — 참여 횟수 많은 순
                  </Typography>
                  {renderAccountsTable(realShipOnlyAccounts)}
                </Box>
              )}
            </>
          )}
        </Box>
      </Paper>

      {/* 상세 Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">계좌별 buyer 상세</Typography>
            <Typography variant="h6">
              {detailAccount?.account_info || detailAccount?.account_normalized}
            </Typography>
          </Box>
          <IconButton onClick={() => setDetailOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell>연월브랜드</TableCell>
                    <TableCell>캠페인</TableCell>
                    <TableCell>품목</TableCell>
                    <TableCell align="center">일차</TableCell>
                    <TableCell>주문번호</TableCell>
                    <TableCell>구매자명</TableCell>
                    <TableCell>수취인명</TableCell>
                    <TableCell>출고유형</TableCell>
                    <TableCell>주문입력일</TableCell>
                    <TableCell>첫 리뷰</TableCell>
                    <TableCell align="center">상태</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailRows.length === 0 ? (
                    <TableRow><TableCell colSpan={11} align="center" sx={{ color: 'text.secondary' }}>데이터 없음</TableCell></TableRow>
                  ) : detailRows
                      .slice(detailPage * detailRowsPerPage, detailPage * detailRowsPerPage + detailRowsPerPage)
                      .map(r => {
                    const status = REVIEW_STATUS_LABEL[r.review_status] || REVIEW_STATUS_LABEL.unknown;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.monthly_brand_name || '-'}</TableCell>
                        <TableCell>{r.campaign_name || '-'}</TableCell>
                        <TableCell>{r.product_name || '-'}</TableCell>
                        <TableCell align="center">{r.day_group ?? '-'}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.order_number || '-'}</TableCell>
                        <TableCell>{r.buyer_name || '-'}</TableCell>
                        <TableCell>{r.recipient_name || '-'}</TableCell>
                        <TableCell>{r.shipping_type || '-'}</TableCell>
                        <TableCell>{fmtDate(r.info_entered_at)}</TableCell>
                        <TableCell>{fmtDate(r.first_review_at)}</TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={status.label} color={status.color} variant={status.color === 'default' ? 'outlined' : 'filled'} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <TablePagination
            component="div"
            count={detailRows.length}
            page={detailPage}
            onPageChange={(_, newPage) => setDetailPage(newPage)}
            rowsPerPage={detailRowsPerPage}
            onRowsPerPageChange={(e) => {
              setDetailRowsPerPage(parseInt(e.target.value, 10));
              setDetailPage(0);
            }}
            rowsPerPageOptions={[50, 100, 200]}
            labelRowsPerPage="페이지당 행수"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 총 ${count}건`}
          />
          <Button onClick={() => setDetailOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default BuyerAnalyticsDashboard;
