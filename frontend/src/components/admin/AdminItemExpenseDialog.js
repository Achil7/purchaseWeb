import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Box, Button, Typography, Paper, Divider, Alert
} from '@mui/material';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import itemService from '../../services/itemService';

function AdminItemExpenseDialog({ open, onClose, item, onSave }) {
  const [formData, setFormData] = useState({
    expense_product: '',
    expense_courier: '',
    expense_review: '',
    expense_other: '',
    expense_note: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && item) {
      setFormData({
        expense_product: item.expense_product || '',
        expense_courier: item.expense_courier || '',
        expense_review: item.expense_review || '',
        expense_other: item.expense_other || '',
        expense_note: item.expense_note || ''
      });
      setError('');
    }
  }, [open, item]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      // TEXT 필드로 저장 (숫자 변환 없이 원본 텍스트 전달)
      const expenseData = {
        expense_product: formData.expense_product || null,
        expense_courier: formData.expense_courier || null,
        expense_review: formData.expense_review || null,
        expense_other: formData.expense_other || null,
        expense_note: formData.expense_note || null
      };
      await itemService.updateItemExpense(item.id, expenseData);
      if (onSave) onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || '지출 정보 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // TEXT 필드를 숫자로 파싱하는 헬퍼 함수
  const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  // 택배대행 여부를 boolean으로 판단하는 헬퍼 함수
  const isCourierService = (value) => {
    if (!value) return false;
    const str = String(value).toUpperCase().trim();
    return str === 'Y' || str === 'YES' || str === '1' || str === 'TRUE';
  };

  // 계산값들 (TEXT 필드를 숫자로 파싱)
  const totalCount = parseNumber(item?.total_purchase_count);
  const salePrice = parseNumber(item?.sale_price_per_unit);
  const courierPrice = isCourierService(item?.courier_service_yn) ? parseNumber(item?.courier_price_per_unit) : 0;
  const saleRevenue = salePrice * totalCount;
  const courierRevenue = courierPrice * totalCount;
  const totalRevenue = saleRevenue + courierRevenue;
  const totalRevenueVat = Math.round(totalRevenue * 1.1);

  const expenseProduct = parseNumber(formData.expense_product);
  const expenseCourier = parseNumber(formData.expense_courier);
  const expenseReview = parseNumber(formData.expense_review);
  const expenseOther = parseNumber(formData.expense_other);
  const totalExpense = expenseProduct + expenseCourier + expenseReview + expenseOther;
  const margin = totalRevenueVat - totalExpense;
  const marginRate = totalRevenueVat > 0 ? ((margin / totalRevenueVat) * 100).toFixed(1) : 0;

  if (!item) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
        <MoneyOffIcon color="warning" />
        품목 지출 입력
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 품목 정보 */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
          <Typography variant="subtitle2" color="text.secondary">품목 정보</Typography>
          <Typography variant="h6" fontWeight="bold">{item.product_name}</Typography>
          <Typography variant="body2" color="text.secondary">
            총 건수: {totalCount}개 | 판매단가: {salePrice.toLocaleString()}원 |
            택배대행: {item.courier_service_yn || '-'} {courierPrice > 0 ? `(${courierPrice.toLocaleString()}원)` : ''}
          </Typography>
        </Paper>

        {/* 매출 정보 (읽기 전용) */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#e3f2fd', border: '1px solid #90caf9' }}>
          <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ mb: 1 }}>
            매출 정보 (영업사 입력)
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">판매매출</Typography>
              <Typography variant="body2">{saleRevenue.toLocaleString()}원</Typography>
            </Box>
            {item.courier_service_yn && (
              <Box>
                <Typography variant="caption" color="text.secondary">택배매출</Typography>
                <Typography variant="body2">{courierRevenue.toLocaleString()}원</Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">총 매출 (공급가)</Typography>
              <Typography variant="body2" fontWeight="bold">{totalRevenue.toLocaleString()}원</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">총 매출 (VAT 포함)</Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">{totalRevenueVat.toLocaleString()}원</Typography>
            </Box>
          </Box>
        </Paper>

        <Divider sx={{ my: 2 }} />

        {/* 지출 입력 */}
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
          지출 입력
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="제품비 (원)"
            name="expense_product"
            type="number"
            value={formData.expense_product}
            onChange={handleInputChange}
            fullWidth
            size="small"
            helperText={totalCount > 0 && expenseProduct ?
              `개당 ${Math.round(expenseProduct / totalCount).toLocaleString()}원` : ''}
          />
          <TextField
            label="택배비 (원)"
            name="expense_courier"
            type="number"
            value={formData.expense_courier}
            onChange={handleInputChange}
            fullWidth
            size="small"
            helperText={totalCount > 0 && expenseCourier ?
              `개당 ${Math.round(expenseCourier / totalCount).toLocaleString()}원` : ''}
          />
          <TextField
            label="리뷰비용 (원)"
            name="expense_review"
            type="number"
            value={formData.expense_review}
            onChange={handleInputChange}
            fullWidth
            size="small"
            helperText={totalCount > 0 && expenseReview ?
              `개당 ${Math.round(expenseReview / totalCount).toLocaleString()}원` : ''}
          />
          <TextField
            label="기타비용 (원)"
            name="expense_other"
            type="number"
            value={formData.expense_other}
            onChange={handleInputChange}
            fullWidth
            size="small"
          />
          <TextField
            label="지출 메모"
            name="expense_note"
            value={formData.expense_note}
            onChange={handleInputChange}
            fullWidth
            size="small"
            multiline
            rows={2}
          />
        </Box>

        {/* 마진 계산 결과 */}
        <Paper sx={{
          p: 2,
          mt: 3,
          bgcolor: margin >= 0 ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${margin >= 0 ? '#a5d6a7' : '#ef9a9a'}`
        }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: margin >= 0 ? '#2e7d32' : '#c62828' }}>
            마진 계산
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">총 지출</Typography>
              <Typography variant="body2" fontWeight="bold">{totalExpense.toLocaleString()}원</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">순 마진</Typography>
              <Typography variant="h6" fontWeight="bold" color={margin >= 0 ? 'success.main' : 'error.main'}>
                {margin >= 0 ? '+' : ''}{margin.toLocaleString()}원
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">마진율</Typography>
              <Typography variant="body2" fontWeight="bold" color={margin >= 0 ? 'success.main' : 'error.main'}>
                {marginRate}%
              </Typography>
            </Box>
          </Box>
        </Paper>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          취소
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AdminItemExpenseDialog;
