import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert, IconButton, Dialog, DialogContent, Button, Chip
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { buyerService } from '../../services';
import { downloadExcel } from '../../utils/excelExport';

registerAllModules();

const getKoreanToday = () => {
  const koreanDateStr = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = koreanDateStr.replace(/\./g, '').trim().split(/\s+/);
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const COL_HEADERS = ['진행자', '캠페인', '제품명', '주문번호', '구매자', '수취인', '주소', '택배사', '송장번호', '리뷰샷'];

// 리뷰샷 셀 렌더러: 이미지 있으면 "보기" 링크, 없으면 "-"
function reviewRenderer(instance, td, row, col, prop, value) {
  if (value) {
    td.innerHTML = '<a href="#" class="review-link" style="color:#2e7d32;text-decoration:underline;cursor:pointer;font-size:12px;">보기</a>';
  } else {
    td.innerHTML = '<span style="color:#999;font-size:11px;">-</span>';
  }
  td.style.textAlign = 'center';
  return td;
}

const COLUMNS = [
  { data: 'operator_name', readOnly: true },
  { data: 'campaign_name', readOnly: true },
  { data: 'product_name', readOnly: true },
  { data: 'order_number', readOnly: true },
  { data: 'buyer_name', readOnly: true },
  { data: 'recipient_name', readOnly: true },
  { data: 'address', readOnly: true },
  { data: 'courier_company' },
  { data: 'tracking_number' },
  { data: 'image_url', readOnly: true, renderer: reviewRenderer },
];

const COLUMN_WIDTHS = [90, 130, 130, 110, 70, 70, 200, 90, 150, 60];

function AdminCourierTracking() {
  const [selectedDate, setSelectedDate] = useState(getKoreanToday());
  const [buyers, setBuyers] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const hotRef = useRef(null);
  const tableDataRef = useRef([]);
  const changedIdsRef = useRef(new Set());
  const bulkSaveRef = useRef(null);

  const loadBuyers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      const day = selectedDate.getDate();

      const response = await buyerService.getCourierTrackingBuyers(year, month, day);
      const buyersData = response.data || [];
      setBuyers(buyersData);

      const rows = buyersData.map(b => ({
        id: b.id,
        operator_name: b.operator_name || '',
        campaign_name: b.campaign_name || '',
        product_name: b.product_name || '',
        order_number: b.order_number || '',
        buyer_name: b.buyer_name || '',
        recipient_name: b.recipient_name || '',
        address: b.address || '',
        courier_company: b.courier_company || '',
        tracking_number: b.tracking_number || '',
        image_url: b.image_url || '',
      }));
      tableDataRef.current = rows;
      setTableData(rows);
      changedIdsRef.current = new Set();
    } catch (err) {
      console.error('Failed to load courier tracking buyers:', err);
      setError('택배대행 구매자 목록을 불러오는데 실패했습니다.');
      setBuyers([]);
      setTableData([]);
      tableDataRef.current = [];
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadBuyers();
  }, [loadBuyers]);

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const handleToday = () => {
    setSelectedDate(getKoreanToday());
  };

  const handleImageClick = useCallback((imageUrl) => {
    setSelectedImage(imageUrl);
    setImageDialogOpen(true);
  }, []);

  // 시트 편집 추적: 변경된 구매자 id 적재
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData') return;
    changes.forEach(([row, , oldVal, newVal]) => {
      if (oldVal === newVal) return;
      const rowData = tableDataRef.current[row];
      if (rowData && rowData.id != null) {
        changedIdsRef.current.add(rowData.id);
      }
    });
  }, []);

  // 리뷰샷 "보기" 링크 클릭 → 이미지 확대 다이얼로그
  const handleCellMouseDown = useCallback((event, coords) => {
    if (event.target && event.target.classList && event.target.classList.contains('review-link')) {
      event.preventDefault();
      const rowData = tableDataRef.current[coords.row];
      if (rowData && rowData.image_url) {
        handleImageClick(rowData.image_url);
      }
    }
  }, [handleImageClick]);

  // 진행자 그룹 첫 행에 상단 구분선 className 부여
  const cellsConfig = useCallback((row) => {
    const rows = tableDataRef.current;
    if (rows[row] && (row === 0 || rows[row].operator_name !== rows[row - 1]?.operator_name)) {
      return { className: 'operator-group-start' };
    }
    return {};
  }, []);

  const handleBulkSave = useCallback(async () => {
    const ids = Array.from(changedIdsRef.current);
    if (ids.length === 0) {
      alert('변경된 항목이 없습니다.');
      return;
    }
    if (!window.confirm(`${ids.length}건의 송장 정보를 저장하시겠습니까?`)) {
      return;
    }

    setSaving(true);
    try {
      const rowsById = {};
      tableDataRef.current.forEach(r => { rowsById[r.id] = r; });

      await Promise.all(ids.map(id => {
        const r = rowsById[id];
        return buyerService.updateTrackingInfo(id, {
          tracking_number: r.tracking_number,
          courier_company: r.courier_company
        });
      }));

      setBuyers(prev => prev.map(b => {
        const r = rowsById[b.id];
        return r ? { ...b, tracking_number: r.tracking_number, courier_company: r.courier_company } : b;
      }));
      changedIdsRef.current = new Set();
      alert('저장 완료');
    } catch (err) {
      console.error('Failed to bulk save:', err);
      alert('일괄 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, []);

  // 최신 handleBulkSave 참조 유지 (Ctrl+S 핸들러용)
  bulkSaveRef.current = handleBulkSave;

  // Ctrl+S 저장
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        bulkSaveRef.current?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleExcelDownload = () => {
    if (tableDataRef.current.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }
    const header = ['진행자', '캠페인', '제품명', '주문번호', '구매자', '수취인', '주소', '택배사', '송장번호'];
    const rows = tableDataRef.current.map(r => [
      r.operator_name, r.campaign_name, r.product_name, r.order_number,
      r.buyer_name, r.recipient_name, r.address, r.courier_company || '', r.tracking_number || ''
    ]);
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    downloadExcel([header, ...rows], `택배대행송장_${y}-${m}-${d}`, '택배대행송장', false);
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${year}년 ${month}월 ${day}일 (${weekdays[date.getDay()]})`;
  };

  const trackingEnteredCount = buyers.filter(b => b.tracking_number && String(b.tracking_number).trim()).length;
  const trackingNotEnteredCount = buyers.length - trackingEnteredCount;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box>
        {/* 헤더 */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LocalShippingIcon sx={{ fontSize: 28, color: '#00695c' }} />
            <Typography variant="h6" fontWeight="bold">택배대행 송장관리</Typography>
            <Typography variant="caption" color="text.secondary">제품 날짜 기준</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handlePrevDay} title="이전 날짜" size="small">
              <ArrowBackIcon />
            </IconButton>

            <DatePicker
              value={selectedDate}
              onChange={(newDate) => newDate && setSelectedDate(newDate)}
              format="yyyy-MM-dd"
              slotProps={{
                textField: { size: 'small', sx: { width: 150 } }
              }}
            />

            <IconButton onClick={handleNextDay} title="다음 날짜" size="small">
              <ArrowForwardIcon />
            </IconButton>

            <Chip
              label="오늘"
              onClick={handleToday}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ cursor: 'pointer' }}
            />
          </Box>
        </Box>

        {/* 통계바 */}
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#e0f2f1' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" color="#00695c">
                {formatDate(selectedDate)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                총 {buyers.length}명
              </Typography>
              <Chip label={`송장입력: ${trackingEnteredCount}명`} size="small" color="success" variant="outlined" />
              <Chip label={`미입력: ${trackingNotEnteredCount}명`} size="small" color="error" variant="outlined" />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={handleExcelDownload}
                disabled={buyers.length === 0}
                sx={{ fontWeight: 'bold', color: '#00695c', borderColor: '#00695c' }}
              >
                엑셀 다운로드
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SaveIcon />}
                onClick={handleBulkSave}
                disabled={buyers.length === 0 || saving}
                sx={{ fontWeight: 'bold', bgcolor: '#00695c', '&:hover': { bgcolor: '#004d40' } }}
              >
                일괄 저장
              </Button>
            </Box>
          </Box>
        </Paper>

        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
          송장번호 열 맨 위 칸을 선택하고 붙여넣기(Ctrl+V)하면 아래로 한 번에 채워집니다. 저장은 일괄 저장 또는 Ctrl+S.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : buyers.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', color: '#999' }}>
            해당 날짜에 택배대행 구매자가 없습니다.
          </Paper>
        ) : (
          <Paper
            sx={{
              width: '100%',
              overflow: 'hidden',
              borderRadius: 2,
              boxShadow: 3,
              '& td.operator-group-start': { borderTop: '2px solid #00695c' }
            }}
          >
            <HotTable
              ref={hotRef}
              data={tableData}
              columns={COLUMNS}
              colHeaders={COL_HEADERS}
              colWidths={COLUMN_WIDTHS}
              rowHeaders={false}
              width="100%"
              height="calc(100vh - 280px)"
              licenseKey="non-commercial-and-evaluation"
              stretchH="none"
              autoRowSize={false}
              autoColumnSize={false}
              viewportRowRenderingOffset={50}
              manualColumnResize={true}
              copyPaste={true}
              fillHandle={true}
              afterChange={handleAfterChange}
              afterOnCellMouseDown={handleCellMouseDown}
              cells={cellsConfig}
              className="htCenter"
            />
          </Paper>
        )}

        {/* 이미지 확대 다이얼로그 */}
        <Dialog
          open={imageDialogOpen}
          onClose={(event, reason) => { if (reason !== 'backdropClick') setImageDialogOpen(false); }}
          maxWidth="lg"
        >
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            <IconButton
              onClick={() => setImageDialogOpen(false)}
              sx={{
                position: 'absolute', top: 8, right: 8,
                bgcolor: 'rgba(0,0,0,0.5)', color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
              }}
            >
              <CloseIcon />
            </IconButton>
            {selectedImage && (
              <Box
                component="img"
                src={selectedImage}
                alt="리뷰이미지"
                sx={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain' }}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

export default AdminCourierTracking;
