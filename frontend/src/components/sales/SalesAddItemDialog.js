import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography,
  TextField, Box, Button, MenuItem, Alert
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';

function SalesItemDialog({ open, onClose, onSave, mode = 'create', initialData = null }) {
  const emptyFormState = {
    product_name: '',
    description: '',
    status: 'active',
    shipping_type: '실출고',
    keyword: '',
    total_purchase_count: '',
    daily_purchase_count: '',
    product_url: '',
    purchase_option: '',
    product_price: '',
    shipping_deadline: '18:00',
    review_guide: '',
    courier_service_yn: true,
    notes: ''
  };

  const [formData, setFormData] = useState(emptyFormState);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      if (mode === 'edit' && initialData) {
        setFormData({
          product_name: initialData.product_name || '',
          description: initialData.description || '',
          status: initialData.status || 'active',
          shipping_type: initialData.shipping_type || '실출고',
          keyword: initialData.keyword || '',
          total_purchase_count: initialData.total_purchase_count || '',
          daily_purchase_count: initialData.daily_purchase_count || '',
          product_url: initialData.product_url || '',
          purchase_option: initialData.purchase_option || '',
          product_price: initialData.product_price || '',
          shipping_deadline: initialData.shipping_deadline || '18:00',
          review_guide: initialData.review_guide || '',
          courier_service_yn: initialData.courier_service_yn ?? true,
          notes: initialData.notes || ''
        });
      } else {
        setFormData(emptyFormState);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialData]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSave = () => {
    if (!formData.product_name) {
      setError('품목명을 입력해주세요.');
      return;
    }

    // 빈 값은 null로 처리하여 DB 오류 방지
    const itemData = {
      product_name: formData.product_name,
      description: formData.description || null,
      status: formData.status || 'active',
      shipping_type: formData.shipping_type || null,
      keyword: formData.keyword || null,
      total_purchase_count: formData.total_purchase_count ? parseInt(formData.total_purchase_count) : null,
      daily_purchase_count: formData.daily_purchase_count ? parseInt(formData.daily_purchase_count) : null,
      product_url: formData.product_url || null,
      purchase_option: formData.purchase_option || null,
      product_price: formData.product_price ? parseFloat(formData.product_price) : null,
      shipping_deadline: formData.shipping_deadline || null,
      review_guide: formData.review_guide || null,
      courier_service_yn: formData.courier_service_yn,
      notes: formData.notes || null
    };

    onSave(itemData);
  };

  const isEdit = mode === 'edit';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
        {isEdit ? <EditIcon color="primary" /> : <AddCircleIcon color="success" />}
        {isEdit ? '품목 수정' : '품목 추가'}
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {isEdit
            ? '품목 정보를 수정합니다.'
            : '캠페인에 새로운 품목을 추가합니다. 품목 생성 시 이미지 업로드 링크가 자동으로 생성됩니다.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 1행: 기본 정보 - 품목명, 상태, 설명 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
          <Typography fontWeight="bold" sx={{ minWidth: 80, pt: 2 }}>기본 정보</Typography>
          <TextField
            label="품목명 *"
            name="product_name"
            fullWidth
            value={formData.product_name}
            onChange={handleInputChange}
            placeholder="예: 무선 이어폰 A100"
          />
          <TextField
            label="상태"
            name="status"
            fullWidth
            select
            value={formData.status}
            onChange={handleInputChange}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="active">진행 중</MenuItem>
            <MenuItem value="completed">완료</MenuItem>
            <MenuItem value="cancelled">취소</MenuItem>
          </TextField>
          <TextField
            label="설명"
            name="description"
            fullWidth
            value={formData.description}
            onChange={handleInputChange}
            placeholder="품목에 대한 간단한 설명"
          />
        </Box>

        {/* 2행: 제품 정보 - 출고타입, 가격 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
          <Typography fontWeight="bold" sx={{ minWidth: 80, pt: 2 }}>제품 정보</Typography>
          <TextField
            label="미출고/실출고"
            name="shipping_type"
            fullWidth
            select
            value={formData.shipping_type}
            onChange={handleInputChange}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="미출고">미출고</MenuItem>
            <MenuItem value="실출고">실출고</MenuItem>
          </TextField>
          <TextField
            label="제품 구매 가격 (원)"
            name="product_price"
            fullWidth
            type="number"
            value={formData.product_price}
            onChange={handleInputChange}
            placeholder="예: 59000"
          />
        </Box>

        {/* 3행: 출고 마감, 구매 옵션, 택배대행 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, pl: '96px' }}>
          <TextField
            label="출고 마감 시간"
            name="shipping_deadline"
            value={formData.shipping_deadline}
            onChange={handleInputChange}
            placeholder="예: 18:00"
            sx={{ flex: 1 }}
          />
          <TextField
            label="구매 옵션"
            name="purchase_option"
            value={formData.purchase_option}
            onChange={handleInputChange}
            placeholder="예: 블랙 / 기본"
            sx={{ flex: 1 }}
          />
          <TextField
            label="택배대행 Y/N"
            name="courier_service_yn"
            select
            value={formData.courier_service_yn}
            onChange={handleInputChange}
            sx={{ flex: 1, minWidth: 130 }}
          >
            <MenuItem value={true}>Y (사용)</MenuItem>
            <MenuItem value={false}>N (미사용)</MenuItem>
          </TextField>
        </Box>

        {/* 4행: 상품 확인 URL (별도 행) */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, pl: '96px' }}>
          <TextField
            label="상품 확인 URL"
            name="product_url"
            fullWidth
            value={formData.product_url}
            onChange={handleInputChange}
            placeholder="https://example.com/product/..."
          />
        </Box>

        {/* 5행: 캠페인 정보 - 키워드 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
          <Typography fontWeight="bold" sx={{ minWidth: 80, pt: 2 }}>캠페인 정보</Typography>
          <TextField
            label="희망 유입 키워드"
            name="keyword"
            fullWidth
            value={formData.keyword}
            onChange={handleInputChange}
            placeholder="예: 무선이어폰 블루투스이어폰 고음질"
            helperText="키워드를 공백으로 구분하여 입력하세요"
          />
        </Box>

        {/* 6행: 구매 건수, 비고 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, pl: '96px' }}>
          <TextField
            label="총 구매 건수"
            name="total_purchase_count"
            type="number"
            value={formData.total_purchase_count}
            onChange={handleInputChange}
            placeholder="예: 100"
            sx={{ flex: 1 }}
          />
          <TextField
            label="일 구매 건수"
            name="daily_purchase_count"
            type="number"
            value={formData.daily_purchase_count}
            onChange={handleInputChange}
            placeholder="예: 10"
            sx={{ flex: 1 }}
          />
          <TextField
            label="비고"
            name="notes"
            multiline
            rows={2}
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="기타 참고사항"
            sx={{ flex: 2 }}
          />
        </Box>

        {/* 7행: 리뷰가이드 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, pl: '96px' }}>
          <TextField
            label="리뷰가이드 및 소구점"
            name="review_guide"
            fullWidth
            multiline
            rows={3}
            value={formData.review_guide}
            onChange={handleInputChange}
            placeholder="리뷰 작성 시 포함할 내용을 입력하세요"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} color="inherit" size="large">
          취소
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color={isEdit ? 'primary' : 'success'}
          size="large"
          disableElevation
        >
          {isEdit ? '수정하기' : '추가하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SalesItemDialog;
