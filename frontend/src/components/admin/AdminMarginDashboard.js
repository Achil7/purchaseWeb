import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Alert, Button, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Collapse
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';

// 마진 현황 접근 허용 계정
const ALLOWED_MARGIN_USERS = ['masterkangwoo'];

// 견적서 분류 카테고리 (4가지)
const CATEGORIES = {
  review: { label: '구매평 서비스', color: '#1976d2' },
  product: { label: '제품비', color: '#2e7d32' },
  delivery: { label: '택배대행', color: '#ed6c02' },
  other: { label: '기타작업', color: '#757575' }
};

function AdminMarginDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // masterkangwoo 계정만 접근 가능
  useEffect(() => {
    if (user && !ALLOWED_MARGIN_USERS.includes(user.username)) {
      alert('접근 권한이 없습니다.');
      navigate('/admin');
    }
  }, [user, navigate]);

  // 엑셀 업로드 관련 상태
  const fileInputRef = useRef(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState(null);
  const [uploadError, setUploadError] = useState('');

  // 페이지에 표시할 견적서 목록 (localStorage에서 복원)
  const [uploadedEstimates, setUploadedEstimates] = useState(() => {
    try {
      const saved = localStorage.getItem('uploadedEstimates');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Date 객체 복원
        return parsed.map(est => ({
          ...est,
          createdDate: est.createdDate ? new Date(est.createdDate) : null
        }));
      }
    } catch (e) {
      console.error('localStorage 복원 실패:', e);
    }
    return [];
  });

  // 월별 접기/펼치기 상태
  const [expandedMonths, setExpandedMonths] = useState({});

  // uploadedEstimates 변경 시 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem('uploadedEstimates', JSON.stringify(uploadedEstimates));
    } catch (e) {
      console.error('localStorage 저장 실패:', e);
    }
  }, [uploadedEstimates]);

  // 엑셀 날짜 숫자를 JavaScript Date로 변환
  const excelDateToJSDate = (excelDate) => {
    if (!excelDate || typeof excelDate !== 'number') return null;
    return new Date((excelDate - 25569) * 86400 * 1000);
  };

  // 엑셀 파일 업로드 핸들러
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx')) {
      setUploadError('xlsx 파일만 업로드 가능합니다.');
      setUploadDialogOpen(true);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const parsedData = parseEstimateFormat(jsonData, file.name);

        setUploadedData(parsedData);
        setUploadError('');
        setUploadDialogOpen(true);
      } catch (err) {
        console.error('엑셀 파싱 오류:', err);
        setUploadError('엑셀 파일을 읽는 중 오류가 발생했습니다.');
        setUploadDialogOpen(true);
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  // 견적서 포맷 파싱 함수
  const parseEstimateFormat = (rows, fileName) => {
    const result = {
      id: Date.now(),
      fileName,
      companyName: '',
      createdDate: null,
      yearMonth: '', // YYYY-MM 형식
      // 분류별 금액
      categorySummary: {
        review: 0,
        product: 0,
        delivery: 0,
        other: 0
      },
      // 계산된 금액
      supplyAmount: 0,
      vatAmount: 0,
      totalAmount: 0
    };

    // 고객사명 (Row 4 [0])
    if (rows[4]) {
      result.companyName = rows[4][0] || '';
    }

    // 작성일자 (Row 1 [5])
    if (rows[1] && rows[1][5]) {
      const dateValue = rows[1][5];
      if (typeof dateValue === 'number') {
        result.createdDate = excelDateToJSDate(dateValue);
        if (result.createdDate) {
          const year = result.createdDate.getFullYear();
          const month = String(result.createdDate.getMonth() + 1).padStart(2, '0');
          result.yearMonth = `${year}-${month}`;
        }
      }
    }

    // 품목 데이터 파싱 (Row 13부터)
    for (let i = 13; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const productName = String(row[0] || '').trim();
      if (productName === '') continue;
      if (productName.includes('Information')) break;
      if (row[2] && (String(row[2]).includes('공급가총액') ||
                     String(row[2]).includes('부가세') ||
                     String(row[2]).includes('합계금액'))) {
        continue;
      }

      const totalPrice = Number(row[5]) || 0;
      if (totalPrice === 0) continue;

      // 분류
      let category = 'other';
      if (productName.startsWith('구매평 서비스') || productName.includes('구매평')) {
        category = 'review';
      } else if (productName.startsWith('제품명') || productName.startsWith('제품')) {
        category = 'product';
      } else if (productName.startsWith('택배대행') || productName.includes('택배')) {
        category = 'delivery';
      } else if (productName.startsWith('기타작업') || productName.includes('기타')) {
        category = 'other';
      }

      result.categorySummary[category] += totalPrice;
    }

    // 금액 계산
    result.supplyAmount = result.categorySummary.review +
                          result.categorySummary.product +
                          result.categorySummary.delivery +
                          result.categorySummary.other;
    result.vatAmount = result.supplyAmount * 0.1;
    result.totalAmount = result.supplyAmount + result.vatAmount;

    return result;
  };

  // 업로드 다이얼로그 닫기
  const handleUploadDialogClose = () => {
    setUploadDialogOpen(false);
    setUploadedData(null);
    setUploadError('');
  };

  // 페이지에 표시 버튼
  const handleAddToPage = () => {
    if (uploadedData) {
      setUploadedEstimates(prev => [...prev, uploadedData]);
      // 해당 월 자동 펼치기
      if (uploadedData.yearMonth) {
        setExpandedMonths(prev => ({ ...prev, [uploadedData.yearMonth]: true }));
      }
      handleUploadDialogClose();
    }
  };

  // 견적서 삭제
  const handleDeleteEstimate = (id) => {
    setUploadedEstimates(prev => prev.filter(est => est.id !== id));
  };

  // 월별 토글
  const toggleMonth = (yearMonth) => {
    setExpandedMonths(prev => ({ ...prev, [yearMonth]: !prev[yearMonth] }));
  };

  // 금액 포맷팅
  const formatAmount = (amount) => Math.round(amount).toLocaleString();

  // 월별 그룹화 및 합계 계산
  const groupedByMonth = useMemo(() => {
    const groups = {};

    uploadedEstimates.forEach(est => {
      const ym = est.yearMonth || '날짜없음';
      if (!groups[ym]) {
        groups[ym] = {
          estimates: [],
          totals: {
            review: { supply: 0, vat: 0, total: 0 },
            product: { supply: 0, vat: 0, total: 0 },
            delivery: { supply: 0, vat: 0, total: 0 },
            other: { supply: 0, vat: 0, total: 0 },
            all: { supply: 0, vat: 0, total: 0 }
          }
        };
      }
      groups[ym].estimates.push(est);

      // 분류별 합계 누적
      Object.keys(CATEGORIES).forEach(cat => {
        const supply = est.categorySummary[cat];
        const vat = supply * 0.1;
        groups[ym].totals[cat].supply += supply;
        groups[ym].totals[cat].vat += vat;
        groups[ym].totals[cat].total += supply + vat;
      });

      // 전체 합계
      groups[ym].totals.all.supply += est.supplyAmount;
      groups[ym].totals.all.vat += est.vatAmount;
      groups[ym].totals.all.total += est.totalAmount;
    });

    // 월 정렬 (최신순)
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [uploadedEstimates]);

  // 분류별 행 렌더링
  const renderCategoryRow = (label, supply, color) => {
    const vat = supply * 0.1;
    const total = supply + vat;
    return (
      <TableRow>
        <TableCell sx={{ color, fontWeight: 'bold', width: 100 }}>{label}</TableCell>
        <TableCell align="right">{formatAmount(supply)}</TableCell>
        <TableCell align="right">{formatAmount(vat)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatAmount(total)}</TableCell>
      </TableRow>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          견적서 관리 (매출)
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
        >
          견적서 업로드
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx"
          style={{ display: 'none' }}
        />
      </Box>

      {/* 업로드된 견적서가 없을 때 */}
      {uploadedEstimates.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5' }}>
          <DescriptionIcon sx={{ fontSize: 60, color: '#bdbdbd', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            업로드된 견적서가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary">
            "견적서 업로드" 버튼을 클릭하여 xlsx 파일을 업로드하세요.
          </Typography>
        </Paper>
      )}

      {/* 월별 그룹화된 견적서 목록 */}
      {groupedByMonth.map(([yearMonth, { estimates, totals }]) => (
        <Paper key={yearMonth} sx={{ mb: 2 }}>
          {/* 월 헤더 */}
          <Box
            onClick={() => toggleMonth(yearMonth)}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              bgcolor: '#1976d2',
              color: 'white',
              cursor: 'pointer',
              '&:hover': { bgcolor: '#1565c0' }
            }}
          >
            <Typography variant="h6" fontWeight="bold">
              {yearMonth} ({estimates.length}건)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Typography variant="body2">
                공급가: {formatAmount(totals.all.supply)}원
              </Typography>
              <Typography variant="body2">
                부가세: {formatAmount(totals.all.vat)}원
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                합계: {formatAmount(totals.all.total)}원
              </Typography>
              {expandedMonths[yearMonth] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
          </Box>

          <Collapse in={expandedMonths[yearMonth]}>
            {/* 월별 분류 합계 */}
            <Box sx={{ p: 2, bgcolor: '#e3f2fd' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                월 합계
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 100 }}>분류</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>공급가</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>부가세</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>합계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(CATEGORIES).map(([key, { label, color }]) => (
                      <TableRow key={key}>
                        <TableCell sx={{ color, fontWeight: 'bold' }}>{label}</TableCell>
                        <TableCell align="right">{formatAmount(totals[key].supply)}</TableCell>
                        <TableCell align="right">{formatAmount(totals[key].vat)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatAmount(totals[key].total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: '#fff3e0' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>전체</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatAmount(totals.all.supply)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatAmount(totals.all.vat)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{formatAmount(totals.all.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* 개별 견적서 목록 */}
            <Box sx={{ p: 2 }}>
              {estimates.map((est) => (
                <Paper key={est.id} variant="outlined" sx={{ mb: 1, p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {est.companyName || '브랜드명 없음'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {est.createdDate?.toLocaleDateString('ko-KR')} | {est.fileName}
                      </Typography>
                    </Box>
                    <Tooltip title="삭제">
                      <IconButton size="small" color="error" onClick={() => handleDeleteEstimate(est.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', width: 100, py: 0.5 }}>분류</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>공급가</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>부가세</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>합계</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(CATEGORIES).map(([key, { label, color }]) => {
                          const supply = est.categorySummary[key];
                          if (supply === 0) return null; // 0인 항목은 숨김
                          const vat = supply * 0.1;
                          return (
                            <TableRow key={key}>
                              <TableCell sx={{ color, fontWeight: 'bold', py: 0.5 }}>{label}</TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}>{formatAmount(supply)}</TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}>{formatAmount(vat)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>{formatAmount(supply + vat)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>전체</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>{formatAmount(est.supplyAmount)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>{formatAmount(est.vatAmount)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f', py: 0.5 }}>{formatAmount(est.totalAmount)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              ))}
            </Box>
          </Collapse>
        </Paper>
      ))}

      {/* 견적서 업로드 결과 다이얼로그 */}
      <Dialog open={uploadDialogOpen} onClose={handleUploadDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {uploadError ? '업로드 오류' : '견적서 파싱 결과'}
        </DialogTitle>
        <DialogContent dividers>
          {uploadError ? (
            <Alert severity="error">{uploadError}</Alert>
          ) : uploadedData ? (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {uploadedData.companyName || '브랜드명 없음'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  작성일: {uploadedData.createdDate?.toLocaleDateString('ko-KR')} ({uploadedData.yearMonth})
                </Typography>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>분류</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>공급가</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>부가세</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>합계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(CATEGORIES).map(([key, { label, color }]) => {
                      const supply = uploadedData.categorySummary[key];
                      const vat = supply * 0.1;
                      return (
                        <TableRow key={key}>
                          <TableCell sx={{ color, fontWeight: 'bold' }}>{label}</TableCell>
                          <TableCell align="right">{formatAmount(supply)}</TableCell>
                          <TableCell align="right">{formatAmount(vat)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatAmount(supply + vat)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow sx={{ bgcolor: '#fff3e0' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>전체</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatAmount(uploadedData.supplyAmount)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatAmount(uploadedData.vatAmount)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{formatAmount(uploadedData.totalAmount)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUploadDialogClose}>닫기</Button>
          {uploadedData && !uploadError && (
            <Button variant="contained" onClick={handleAddToPage}>
              추가
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminMarginDashboard;
