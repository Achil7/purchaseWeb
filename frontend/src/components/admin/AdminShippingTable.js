import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, Dialog, DialogContent, DialogTitle, DialogActions,
  IconButton, TextField, Select, MenuItem, FormControl
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { buyerService, itemService, itemSlotService } from '../../services';

// 택배사 목록
const COURIER_COMPANIES = [
  '선택안함',
  'CJ대한통운',
  '롯데택배',
  '한진택배',
  '우체국택배',
  '로젠택배',
  'GS편의점택배',
  'CU편의점택배',
  '경동택배',
  '대신택배',
  '일양로지스',
  '합동택배',
  '기타'
];

function AdminShippingTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dayGroup = searchParams.get('dayGroup');

  const [buyers, setBuyers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 송장번호 인라인 수정 상태
  const [editingTracking, setEditingTracking] = useState({});
  const [trackingValues, setTrackingValues] = useState({});

  // 택배사 인라인 수정 상태
  const [editingCourier, setEditingCourier] = useState({});
  const [courierValues, setCourierValues] = useState({});

  // 송장번호 일괄 입력 다이얼로그 상태
  const [trackingBulkDialogOpen, setTrackingBulkDialogOpen] = useState(false);
  const [trackingBulkInput, setTrackingBulkInput] = useState('');
  const [trackingBulkSaving, setTrackingBulkSaving] = useState(false);
  const [bulkCourierCompany, setBulkCourierCompany] = useState('선택안함');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, dayGroup]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [itemRes, buyersRes, slotsRes] = await Promise.all([
        itemService.getItem(itemId),
        buyerService.getBuyersByItem(itemId),
        itemSlotService.getSlotsByItem(itemId)
      ]);

      setItem(itemRes.data);
      setBuyers(buyersRes.data || []);
      setSlots(slotsRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadBuyers = async () => {
    try {
      const response = await buyerService.getBuyersByItem(itemId);
      setBuyers(response.data || []);
    } catch (err) {
      console.error('Failed to load buyers:', err);
    }
  };

  // dayGroup 필터링된 구매자 목록
  const filteredBuyers = useMemo(() => {
    if (!dayGroup) {
      return buyers;
    }

    const dayGroupNum = parseInt(dayGroup, 10);
    const slotBuyerIds = slots
      .filter(slot => slot.day_group === dayGroupNum && slot.buyer_id)
      .map(slot => slot.buyer_id);

    return buyers.filter(buyer => slotBuyerIds.includes(buyer.id));
  }, [buyers, slots, dayGroup]);

  // 송장번호 수정 시작
  const handleStartTrackingEdit = (buyerId, currentValue) => {
    setEditingTracking(prev => ({ ...prev, [buyerId]: true }));
    setTrackingValues(prev => ({ ...prev, [buyerId]: currentValue || '' }));
  };

  // 송장번호 저장
  const handleSaveTracking = async (buyerId) => {
    try {
      await buyerService.updateTrackingNumber(buyerId, trackingValues[buyerId]);
      setBuyers(prev => prev.map(buyer =>
        buyer.id === buyerId
          ? { ...buyer, tracking_number: trackingValues[buyerId] }
          : buyer
      ));
      setEditingTracking(prev => ({ ...prev, [buyerId]: false }));
    } catch (err) {
      console.error('Failed to update tracking number:', err);
      alert('송장번호 수정에 실패했습니다.');
    }
  };

  // 송장번호 수정 취소
  const handleCancelTrackingEdit = (buyerId) => {
    setEditingTracking(prev => ({ ...prev, [buyerId]: false }));
  };

  // 택배사 변경
  const handleCourierChange = async (buyerId, newCourier) => {
    try {
      await buyerService.updateCourierCompany(buyerId, newCourier === '선택안함' ? null : newCourier);
      setBuyers(prev => prev.map(buyer =>
        buyer.id === buyerId
          ? { ...buyer, courier_company: newCourier === '선택안함' ? null : newCourier }
          : buyer
      ));
    } catch (err) {
      console.error('Failed to update courier company:', err);
      alert('택배사 변경에 실패했습니다.');
    }
  };

  // 송장번호 일괄 입력 다이얼로그 열기
  const handleOpenTrackingBulk = () => {
    setTrackingBulkInput('');
    setBulkCourierCompany('선택안함');
    setTrackingBulkDialogOpen(true);
  };

  // 송장번호 일괄 입력 저장
  const handleSaveTrackingBulk = async () => {
    if (!trackingBulkInput.trim()) {
      alert('송장번호를 입력해주세요.');
      return;
    }

    setTrackingBulkSaving(true);
    try {
      const response = await buyerService.updateTrackingNumbersBulk(
        itemId,
        trackingBulkInput,
        bulkCourierCompany !== '선택안함' ? bulkCourierCompany : null
      );
      await loadBuyers();
      setTrackingBulkDialogOpen(false);
      alert(response.message || `${response.count}명의 송장번호가 입력되었습니다.`);
    } catch (err) {
      console.error('Failed to save tracking numbers bulk:', err);
      const errorMsg = err.response?.data?.message || '송장번호 일괄 입력에 실패했습니다.';
      alert(errorMsg);
    } finally {
      setTrackingBulkSaving(false);
    }
  };

  // 임시 구매자(선 업로드) 수
  const tempBuyerCount = filteredBuyers.filter(b => b.is_temporary).length;

  // 송장번호 입력된 구매자 수
  const shippedCount = filteredBuyers.filter(b => !b.is_temporary && b.tracking_number).length;
  const totalBuyerCount = filteredBuyers.filter(b => !b.is_temporary).length;

  const columns = [
    { id: 'orderNum', label: '주문번호', width: 120 },
    { id: 'buyer', label: '구매자', width: 80 },
    { id: 'recipient', label: '수취인', width: 80 },
    { id: 'contact', label: '연락처', width: 130 },
    { id: 'address', label: '주소', width: 300 },
    { id: 'tracking', label: '송장번호', width: 150 },
    { id: 'courier', label: '택배사', width: 130 },
    { id: 'image', label: '리뷰샷', width: 80 },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
             <Button startIcon={<ArrowBackIcon/>} onClick={() => navigate(-1)} size="small">뒤로</Button>
             <Typography variant="h5" fontWeight="bold">송장관리</Typography>
           </Box>
           <Typography variant="body2" color="text.secondary">
             제품: {item?.product_name || itemId} | 총 {totalBuyerCount}명
             {dayGroup && buyers.length !== filteredBuyers.length && (
               <Typography component="span" variant="caption" sx={{ ml: 1, color: '#666' }}>
                 (전체 {buyers.filter(b => !b.is_temporary).length}명 중)
               </Typography>
             )}
             {tempBuyerCount > 0 && (
               <Chip
                 label={`선 업로드 ${tempBuyerCount}건`}
                 color="warning"
                 size="small"
                 sx={{ ml: 1 }}
                 icon={<HourglassEmptyIcon />}
               />
             )}
           </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary">
              송장입력: <strong style={{ color: '#1976d2' }}>{shippedCount}명</strong> / {totalBuyerCount}명
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<LocalShippingIcon />}
            onClick={handleOpenTrackingBulk}
            sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}
          >
            송장번호 일괄입력
          </Button>
        </Box>
      </Box>

      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
        <TableContainer sx={{ maxHeight: '75vh' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.id === 'image' ? 'center' : 'left'}
                    sx={{
                        fontWeight: 'bold',
                        bgcolor: '#e3f2fd',
                        whiteSpace: 'nowrap',
                        minWidth: col.width,
                        verticalAlign: 'bottom'
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBuyers.length > 0 ? (
                filteredBuyers.map((buyer) => (
                  <TableRow
                    key={buyer.id}
                    hover
                    sx={{
                      bgcolor: buyer.is_temporary ? '#fffde7' : 'inherit',
                      '&:hover': { bgcolor: buyer.is_temporary ? '#fff9c4' : '#f5f5f5' }
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {buyer.order_number}
                      {buyer.is_temporary && (
                        <Chip
                          label="선업로드"
                          color="warning"
                          size="small"
                          sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{buyer.buyer_name}</TableCell>
                    <TableCell>{buyer.recipient_name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.contact}</TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 250, lineHeight: 1.5 }}>
                      {buyer.address}
                    </TableCell>

                    {/* 송장번호 */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {editingTracking[buyer.id] ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextField
                            size="small"
                            value={trackingValues[buyer.id] || ''}
                            onChange={(e) => setTrackingValues(prev => ({ ...prev, [buyer.id]: e.target.value }))}
                            placeholder="송장번호"
                            sx={{ width: 100 }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTracking(buyer.id);
                              if (e.key === 'Escape') handleCancelTrackingEdit(buyer.id);
                            }}
                            autoFocus
                          />
                          <IconButton size="small" color="primary" onClick={() => handleSaveTracking(buyer.id)}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="default" onClick={() => handleCancelTrackingEdit(buyer.id)}>
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box
                          onClick={() => handleStartTrackingEdit(buyer.id, buyer.tracking_number)}
                          sx={{
                            cursor: 'pointer',
                            border: '1px solid #e0e0e0',
                            bgcolor: buyer.tracking_number ? '#e8f5e9' : '#fafafa',
                            '&:hover': { bgcolor: '#f0f0f0', borderColor: '#bdbdbd' },
                            p: 0.5,
                            borderRadius: 1,
                            minHeight: 28,
                            minWidth: 80
                          }}
                        >
                          {buyer.tracking_number || <Typography variant="caption" color="text.disabled">클릭하여 입력</Typography>}
                        </Box>
                      )}
                    </TableCell>

                    {/* 택배사 */}
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 110 }}>
                        <Select
                          value={buyer.courier_company || '선택안함'}
                          onChange={(e) => handleCourierChange(buyer.id, e.target.value)}
                          sx={{ fontSize: '0.85rem' }}
                        >
                          {COURIER_COMPANIES.map((company) => (
                            <MenuItem key={company} value={company} sx={{ fontSize: '0.85rem' }}>
                              {company}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>

                    {/* 리뷰샷 여부 */}
                    <TableCell align="center">
                      {buyer.images && buyer.images.length > 0 ? (
                        <Chip label="있음" color="success" size="small" />
                      ) : (
                        <Chip label="없음" size="small" variant="outlined" sx={{ color: '#999' }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">등록된 구매자가 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 송장번호 일괄 입력 다이얼로그 */}
      <Dialog
        open={trackingBulkDialogOpen}
        onClose={() => setTrackingBulkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#1976d2', color: 'white' }}>
          <LocalShippingIcon />
          송장번호 일괄 입력
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>구매자 수: {buyers.filter(b => !b.is_temporary).length}명</strong><br />
              구매자 등록 순서대로 송장번호가 매칭됩니다.<br />
              송장번호 개수와 구매자 수가 일치해야 합니다.
            </Typography>
          </Alert>

          {/* 택배사 일괄 선택 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>택배사 일괄 선택</Typography>
            <FormControl fullWidth size="small">
              <Select
                value={bulkCourierCompany}
                onChange={(e) => setBulkCourierCompany(e.target.value)}
              >
                {COURIER_COMPANIES.map((company) => (
                  <MenuItem key={company} value={company}>
                    {company}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            multiline
            fullWidth
            rows={10}
            value={trackingBulkInput}
            onChange={(e) => setTrackingBulkInput(e.target.value)}
            placeholder="송장번호를 한 줄에 하나씩 입력하세요&#10;&#10;예시:&#10;1234567890&#10;2345678901&#10;3456789012"
            variant="outlined"
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
                fontSize: '14px'
              }
            }}
          />
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              입력된 송장번호: {trackingBulkInput.split('\n').filter(t => t.trim()).length}개
            </Typography>
            {trackingBulkInput.split('\n').filter(t => t.trim()).length !== buyers.filter(b => !b.is_temporary).length && trackingBulkInput.trim() && (
              <Chip
                label="개수 불일치"
                color="error"
                size="small"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setTrackingBulkDialogOpen(false)} disabled={trackingBulkSaving}>
            취소
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveTrackingBulk}
            disabled={trackingBulkSaving || !trackingBulkInput.trim()}
            startIcon={trackingBulkSaving ? <CircularProgress size={16} color="inherit" /> : <LocalShippingIcon />}
          >
            {trackingBulkSaving ? '저장 중...' : '일괄 저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AdminShippingTable;
