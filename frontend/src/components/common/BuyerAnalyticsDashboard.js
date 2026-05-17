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
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { buyerAnalyticsService } from '../../services';
import { downloadExcel } from '../../utils/excelExport';

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

function BuyerAnalyticsDashboard({ viewAsUserId = null }) {
  // 필터 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overdueDays, setOverdueDays] = useState(14);
  const [overdueThreshold, setOverdueThreshold] = useState(1); // M회 이상 기한 초과 (Worst 탭 필터)
  const [minParticipation, setMinParticipation] = useState(3);
  const [topN, setTopN] = useState(10);
  const [courierFilter, setCourierFilter] = useState('all'); // 'all' | 'Y' | 'N'
  const [accountKeyword, setAccountKeyword] = useState(''); // 계좌(원본) 부분 일치 검색

  // 데이터
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [noAssignment, setNoAssignment] = useState(false); // 배정 0건 (operator/view-operator 모드)

  // 상세 dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(0);
  const [detailRowsPerPage, setDetailRowsPerPage] = useState(50);
  const [detailStatusFilter, setDetailStatusFilter] = useState('all');

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError('');
    setNoAssignment(false);
    try {
      const params = {
        overdueDays,
        minParticipation
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (courierFilter !== 'all') params.courierFilter = courierFilter;
      if (accountKeyword.trim()) params.accountKeyword = accountKeyword.trim();
      if (viewAsUserId) params.viewAsUserId = viewAsUserId;
      const res = await buyerAnalyticsService.getAccounts(params);
      setAccounts(res.data || []);
      if (res?._scope === 'no_assignment') setNoAssignment(true);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || '조회 실패');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, overdueDays, minParticipation, courierFilter, accountKeyword, viewAsUserId]);

  const openDetail = useCallback(async (account) => {
    setDetailAccount(account);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRows([]);
    setDetailPage(0);
    setDetailStatusFilter('all');
    try {
      const detailParams = { overdueDays };
      if (courierFilter !== 'all') detailParams.courierFilter = courierFilter;
      if (viewAsUserId) detailParams.viewAsUserId = viewAsUserId;
      const res = await buyerAnalyticsService.getAccountBuyers(account.account_normalized, detailParams);
      setDetailRows(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || '상세 조회 실패');
    } finally {
      setDetailLoading(false);
    }
  }, [overdueDays, courierFilter, viewAsUserId]);

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

  // 엑셀 다운로드: 계좌 단위 표 변환
  const buildAccountsExcelData = (rows) => {
    const header = [
      '계좌(원본)', '계좌번호(정규화)', '총 참여', '완료', '완료율(%)',
      '기한 내', '기한 초과(합)', '기한 초과(늦은제출)', '기한 초과(미제출)',
      '미출고 횟수', '실출고 횟수'
    ];
    const body = rows.map(r => [
      r.account_info || r.account_normalized || '',
      r.account_normalized || '',
      r._total,
      r._completed,
      Number(r._completionRate.toFixed(1)),
      r._inTime,
      r._overdueTotal,
      r._overdueLate,
      r._overduePending,
      r._noShipOnly,
      r._realShipOnly
    ]);
    return [header, ...body];
  };

  const handleDownloadTab = (tabIndex) => {
    if (tabIndex === 0) {
      downloadExcel(buildAccountsExcelData(worstCompletion), '구매자분석_완료율낮은순', '완료율낮은순');
    } else if (tabIndex === 1) {
      downloadExcel(buildAccountsExcelData(bestInTime), '구매자분석_기한내제출많은순', '기한내제출많은순');
    } else if (tabIndex === 2) {
      downloadExcel(buildAccountsExcelData(worstOverdue), '구매자분석_기한초과많은순', '기한초과많은순');
    } else if (tabIndex === 3) {
      // 출고 편중자 — 두 섹션을 한 파일의 시트 2개로? 우선 둘을 합쳐 표시 (구분 컬럼 추가)
      const header = [
        '편중 유형', '계좌(원본)', '계좌번호(정규화)', '총 참여', '완료', '완료율(%)',
        '기한 내', '기한 초과(합)', '기한 초과(늦은제출)', '기한 초과(미제출)',
        '미출고 횟수', '실출고 횟수'
      ];
      const body = [
        ...noShipOnlyAccounts.map(r => ['미출고에만', r.account_info || r.account_normalized || '', r.account_normalized || '', r._total, r._completed, Number(r._completionRate.toFixed(1)), r._inTime, r._overdueTotal, r._overdueLate, r._overduePending, r._noShipOnly, r._realShipOnly]),
        ...realShipOnlyAccounts.map(r => ['실출고에만', r.account_info || r.account_normalized || '', r.account_normalized || '', r._total, r._completed, Number(r._completionRate.toFixed(1)), r._inTime, r._overdueTotal, r._overdueLate, r._overduePending, r._noShipOnly, r._realShipOnly])
      ];
      downloadExcel([header, ...body], '구매자분석_출고편중자', '출고편중자');
    }
  };

  const handleDownloadDetail = () => {
    if (!detailAccount) return;
    const header = [
      '연월브랜드', '캠페인', '품목', '일차', '주문번호', '구매자명', '수취인명',
      '출고유형', '주문입력일', '첫 리뷰', '상태'
    ];
    const body = filteredDetailRows.map(r => {
      const status = REVIEW_STATUS_LABEL[r.review_status] || REVIEW_STATUS_LABEL.unknown;
      return [
        r.monthly_brand_name || '',
        r.campaign_name || '',
        r.product_name || '',
        r.day_group ?? '',
        r.order_number || '',
        r.buyer_name || '',
        r.recipient_name || '',
        r.shipping_type || '',
        r.info_entered_at ? new Date(r.info_entered_at).toLocaleString('ko-KR', { hour12: false }) : '',
        r.first_review_at ? new Date(r.first_review_at).toLocaleString('ko-KR', { hour12: false }) : '',
        status.label
      ];
    });
    const accountSafe = (detailAccount.account_info || detailAccount.account_normalized || '계좌').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    downloadExcel([header, ...body], `구매자분석_상세_${accountSafe}`, '계좌별buyer상세');
  };

  // 상세 Dialog: 상태 필터 적용한 결과
  const filteredDetailRows = useMemo(() => {
    if (detailStatusFilter === 'all') return detailRows;
    return detailRows.filter(r => r.review_status === detailStatusFilter);
  }, [detailRows, detailStatusFilter]);

  // 상태별 카운트 (필터 옆에 표시)
  const detailStatusCounts = useMemo(() => {
    const counts = { all: detailRows.length, in_time: 0, overdue_late: 0, overdue_pending: 0, in_progress: 0, unknown: 0 };
    detailRows.forEach(r => {
      if (counts[r.review_status] !== undefined) counts[r.review_status] += 1;
    });
    return counts;
  }, [detailRows]);

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
          <TextField
            select
            label="택배대행"
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
            size="small"
            sx={{ width: 130 }}
          >
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="Y">대행 (Y)</MenuItem>
            <MenuItem value="N">대행 안함 (N)</MenuItem>
          </TextField>
          <TextField
            label="계좌 검색 (이름/번호)"
            placeholder="예: 신현우 또는 1002-678"
            value={accountKeyword}
            onChange={(e) => setAccountKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            size="small"
            sx={{ width: 220 }}
          />
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

      {noAssignment && (
        <Alert severity="info" sx={{ mb: 2 }}>
          배정된 캠페인이 없어 분석할 데이터가 없습니다.
        </Alert>
      )}

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
        <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ flex: 1 }}>
            <Tab label="완료율 낮은 순" />
            <Tab label="기한 내 제출 많은 순" />
            <Tab label="기한 초과 많은 순" />
            <Tab label="출고 편중자" />
          </Tabs>
          <Button
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={() => handleDownloadTab(tab)}
            disabled={loading || accounts.length === 0}
            sx={{ mr: 2, flexShrink: 0 }}
          >
            엑셀 다운로드
          </Button>
        </Box>
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
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <TextField
                  select
                  size="small"
                  label="상태 필터"
                  value={detailStatusFilter}
                  onChange={(e) => { setDetailStatusFilter(e.target.value); setDetailPage(0); }}
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="all">전체 ({detailStatusCounts.all})</MenuItem>
                  <MenuItem value="in_time">기한 내 ({detailStatusCounts.in_time})</MenuItem>
                  <MenuItem value="overdue_late">늦은 제출 ({detailStatusCounts.overdue_late})</MenuItem>
                  <MenuItem value="overdue_pending">기한 초과 미제출 ({detailStatusCounts.overdue_pending})</MenuItem>
                  <MenuItem value="in_progress">진행 중 ({detailStatusCounts.in_progress})</MenuItem>
                  <MenuItem value="unknown">미입력 ({detailStatusCounts.unknown})</MenuItem>
                </TextField>
                <Typography variant="caption" color="text.secondary">
                  {detailStatusFilter === 'all' ? `총 ${detailRows.length}건` : `필터링: ${filteredDetailRows.length} / 전체 ${detailRows.length}건`}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleDownloadDetail}
                  disabled={filteredDetailRows.length === 0}
                >
                  엑셀 다운로드
                </Button>
              </Box>
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
                  {filteredDetailRows.length === 0 ? (
                    <TableRow><TableCell colSpan={11} align="center" sx={{ color: 'text.secondary' }}>데이터 없음</TableCell></TableRow>
                  ) : filteredDetailRows
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
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <TablePagination
            component="div"
            count={filteredDetailRows.length}
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
