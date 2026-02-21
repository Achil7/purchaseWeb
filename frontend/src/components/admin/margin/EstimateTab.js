import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Alert, Button, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Collapse, CircularProgress
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import * as XLSX from 'xlsx';
import * as estimateService from '../../../services/estimateService';

// 견적서 분류 카테고리
const CATEGORIES = {
  review: { label: '구매평 서비스', color: '#1976d2' },
  product: { label: '제품비', color: '#2e7d32' },
  delivery: { label: '택배대행', color: '#ed6c02' },
  other: { label: '기타작업', color: '#757575' }
};

function EstimateTab() {
  const fileInputRef = useRef(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [estimates, setEstimates] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});

  const loadEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await estimateService.getEstimates();
      const converted = data.map(est => ({
        id: est.id,
        fileName: est.file_name,
        companyName: est.company_name,
        createdDate: est.estimate_date ? new Date(est.estimate_date) : null,
        yearMonth: est.estimate_date ?
          `${new Date(est.estimate_date).getFullYear()}-${String(new Date(est.estimate_date).getMonth() + 1).padStart(2, '0')}` :
          '날짜없음',
        categorySummary: {
          review: parseFloat(est.category_review) || 0,
          product: parseFloat(est.category_product) || 0,
          delivery: parseFloat(est.category_delivery) || 0,
          other: parseFloat(est.category_other) || 0
        },
        supplyAmount: parseFloat(est.supply_amount) || 0,
        vatAmount: parseFloat(est.vat_amount) || 0,
        totalAmount: parseFloat(est.total_amount) || 0
      }));
      setEstimates(converted);
    } catch (error) {
      console.error('견적서 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  const excelDateToJSDate = (excelDate) => {
    if (!excelDate || typeof excelDate !== 'number') return null;
    return new Date((excelDate - 25569) * 86400 * 1000);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
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

  const parseEstimateFormat = (rows, fileName) => {
    const result = {
      fileName,
      companyName: '',
      companyContact: '',
      companyTel: '',
      companyEmail: '',
      agencyName: '',
      agencyRepresentative: '',
      agencyTel: '',
      agencyEmail: '',
      createdDate: null,
      yearMonth: '',
      categorySummary: { review: 0, product: 0, delivery: 0, other: 0 },
      items: [],
      supplyAmount: 0,
      vatAmount: 0,
      totalAmount: 0
    };

    if (rows[4]) {
      result.companyName = rows[4][0] || '';
      result.agencyName = rows[4][3] || '';
    }
    if (rows[5]) {
      result.companyContact = rows[5][1] || '';
      result.agencyRepresentative = rows[5][5] || '';
    }
    if (rows[6]) result.companyTel = rows[6][1] || '';
    if (rows[7]) {
      result.companyEmail = rows[7][1] || '';
      result.agencyTel = rows[7][5] || '';
    }

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

    for (let i = 13; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const productName = String(row[0] || '').trim();
      if (productName === '') continue;
      if (productName.includes('Information')) break;
      if (row[2] && (String(row[2]).includes('공급가총액') || String(row[2]).includes('부가세') || String(row[2]).includes('합계금액'))) continue;

      const quantity = Number(row[3]) || 0;
      const unitPrice = Number(row[4]) || 0;
      const totalPrice = Number(row[5]) || 0;
      if (totalPrice === 0) continue;

      let category = 'other';
      if (productName.includes('리뷰') || productName.includes('구매평')) category = 'review';
      else if (productName.includes('택배')) category = 'delivery';
      else if (productName.includes('제품비') || productName.includes('입금대행') || /^\d{1,2}\/\d{1,2}/.test(productName)) category = 'product';

      result.items.push({ name: productName, category, quantity, unitPrice, totalPrice });
      result.categorySummary[category] += totalPrice;
    }

    result.supplyAmount = Object.values(result.categorySummary).reduce((a, b) => a + b, 0);
    result.vatAmount = result.supplyAmount * 0.1;
    result.totalAmount = result.supplyAmount + result.vatAmount;
    return result;
  };

  const handleUploadDialogClose = () => {
    setUploadDialogOpen(false);
    setUploadedData(null);
    setUploadError('');
  };

  const handleSaveToDb = async () => {
    if (!uploadedData) return;
    setSaving(true);
    try {
      await estimateService.createEstimate({
        file_name: uploadedData.fileName,
        company_name: uploadedData.companyName,
        company_contact: uploadedData.companyContact,
        company_tel: uploadedData.companyTel,
        company_email: uploadedData.companyEmail,
        agency_name: uploadedData.agencyName,
        agency_representative: uploadedData.agencyRepresentative,
        agency_tel: uploadedData.agencyTel,
        agency_email: uploadedData.agencyEmail,
        category_review: uploadedData.categorySummary.review,
        category_product: uploadedData.categorySummary.product,
        category_delivery: uploadedData.categorySummary.delivery,
        category_other: uploadedData.categorySummary.other,
        supply_amount: uploadedData.supplyAmount,
        vat_amount: uploadedData.vatAmount,
        total_amount: uploadedData.totalAmount,
        items: uploadedData.items,
        estimate_date: uploadedData.createdDate?.toISOString().split('T')[0]
      });
      await loadEstimates();
      if (uploadedData.yearMonth) {
        setExpandedMonths(prev => ({ ...prev, [uploadedData.yearMonth]: true }));
      }
      handleUploadDialogClose();
    } catch (error) {
      console.error('저장 실패:', error);
      setUploadError('저장에 실패했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEstimate = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await estimateService.deleteEstimate(id);
      await loadEstimates();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const toggleMonth = (yearMonth) => {
    setExpandedMonths(prev => ({ ...prev, [yearMonth]: !prev[yearMonth] }));
  };

  const formatAmount = (amount) => Math.round(amount).toLocaleString();

  const groupedByMonth = useMemo(() => {
    const groups = {};
    estimates.forEach(est => {
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
      Object.keys(CATEGORIES).forEach(cat => {
        const supply = est.categorySummary[cat];
        const vat = supply * 0.1;
        groups[ym].totals[cat].supply += supply;
        groups[ym].totals[cat].vat += vat;
        groups[ym].totals[cat].total += supply + vat;
      });
      groups[ym].totals.all.supply += est.supplyAmount;
      groups[ym].totals.all.vat += est.vatAmount;
      groups[ym].totals.all.total += est.totalAmount;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [estimates]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold">견적서 목록</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadEstimates} disabled={loading}>
            새로고침
          </Button>
          <Button size="small" variant="contained" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
            견적서 업로드
          </Button>
        </Box>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx" style={{ display: 'none' }} />
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && estimates.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5' }}>
          <DescriptionIcon sx={{ fontSize: 48, color: '#bdbdbd', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            업로드된 견적서가 없습니다. "견적서 업로드" 버튼으로 xlsx 파일을 업로드하세요.
          </Typography>
        </Paper>
      )}

      {!loading && groupedByMonth.map(([yearMonth, { estimates: monthEstimates, totals }]) => (
        <Paper key={yearMonth} sx={{ mb: 2 }}>
          <Box
            onClick={() => toggleMonth(yearMonth)}
            sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              p: 1.5, bgcolor: '#1976d2', color: 'white', cursor: 'pointer',
              '&:hover': { bgcolor: '#1565c0' }
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold">
              {yearMonth} ({monthEstimates.length}건)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">공급가: {formatAmount(totals.all.supply)}원</Typography>
              <Typography variant="body2">부가세: {formatAmount(totals.all.vat)}원</Typography>
              <Typography variant="body1" fontWeight="bold">합계: {formatAmount(totals.all.total)}원</Typography>
              {expandedMonths[yearMonth] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
          </Box>

          <Collapse in={expandedMonths[yearMonth]}>
            <Box sx={{ p: 2, bgcolor: '#e3f2fd' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>월 합계</Typography>
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

            <Box sx={{ p: 2 }}>
              {monthEstimates.map((est) => (
                <Paper key={est.id} variant="outlined" sx={{ mb: 1, p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">{est.companyName || '브랜드명 없음'}</Typography>
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
                          if (supply === 0) return null;
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

      {/* 업로드 다이얼로그 */}
      <Dialog open={uploadDialogOpen} onClose={handleUploadDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{uploadError ? '업로드 오류' : '견적서 파싱 결과'}</DialogTitle>
        <DialogContent dividers>
          {uploadError ? (
            <Alert severity="error">{uploadError}</Alert>
          ) : uploadedData ? (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">{uploadedData.companyName || '브랜드명 없음'}</Typography>
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
            <Button variant="contained" onClick={handleSaveToDb} disabled={saving}>
              {saving ? '저장 중...' : 'DB에 저장'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EstimateTab;
